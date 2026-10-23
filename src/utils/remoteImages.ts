import { imageMetadata } from "astro/assets/utils";

/** Hosts whose images Astro may fetch and optimize (used in astro.config). */
export const IMAGE_DOMAINS = ["photo.weenas.com", "img.weenas.com", "cmake.org"];

const ATTEMPTS = 4;
/** Probes read only a few KB, so a plain overall timeout is fine for them. */
const TIMEOUT_MS = 60_000;
/**
 * Downloads abort only when no data arrives for this long, so a large file
 * (the 43 MB GIF) can finish over a slow home uplink as long as it keeps
 * flowing; MAX_DOWNLOAD_MS caps a single attempt.
 */
const STALL_MS = 30_000;
const MAX_DOWNLOAD_MS = 10 * 60_000;
/** Marks our own size probes, which stream only the first bytes. */
const PROBE_HEADER = "x-blog-image-probe";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(task: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt < ATTEMPTS) await sleep(1000 * attempt);
    }
  }
  throw lastError;
}

/** Fetches and buffers the whole body, aborting if the transfer stalls. */
async function fetchBuffered(
  realFetch: typeof fetch,
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const overall = setTimeout(
    () => controller.abort(new Error("download took too long")),
    MAX_DOWNLOAD_MS
  );
  let stall: ReturnType<typeof setTimeout> | undefined;
  const touch = () => {
    clearTimeout(stall);
    stall = setTimeout(
      () => controller.abort(new Error(`no data for ${STALL_MS / 1000}s`)),
      STALL_MS
    );
  };
  try {
    touch();
    const res = await realFetch(input, { ...init, signal: controller.signal });
    let body: Uint8Array<ArrayBuffer> | null = null;
    if (![204, 304].includes(res.status) && res.body) {
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        length += value.length;
        touch();
      }
      body = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.length;
      }
    }
    const headers = new Headers(res.headers);
    // The body is already decoded and complete.
    headers.delete("content-encoding");
    headers.delete("content-length");
    return new Response(body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  } finally {
    clearTimeout(stall);
    clearTimeout(overall);
  }
}

function isImageHost(input: RequestInfo | URL) {
  const url = input instanceof Request ? input.url : String(input);
  try {
    return IMAGE_DOMAINS.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Astro downloads remote images with the global fetch and only warns when a
 * download breaks mid-body ("TypeError: terminated"), leaving pages pointing
 * at files that were never written. For the image hosts, read the whole body
 * here with a stall timeout and retries, and hand Astro a buffered response.
 */
export function installImageFetchRetry() {
  const realFetch = globalThis.fetch;
  if ((realFetch as { __imageRetry?: boolean }).__imageRetry) return;

  const fetchWithRetry = (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined)
    );
    if (!isImageHost(input) || headers.has(PROBE_HEADER)) {
      return realFetch(input, init);
    }
    return withRetry(() =>
      fetchBuffered(
        realFetch,
        input instanceof Request ? input.clone() : input,
        init
      )
    );
  };
  Object.assign(fetchWithRetry, { __imageRetry: true });
  globalThis.fetch = fetchWithRetry as typeof fetch;
}

/**
 * Reads an image's size from its first bytes (the photo host ignores Range,
 * so stream and stop as soon as the header parses), with timeout and retries.
 */
export function probeImageSize(src: string) {
  return withRetry(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(src, {
        headers: { [PROBE_HEADER]: "1" },
        signal: controller.signal,
      });
      if (!res.ok || !res.body)
        throw new Error(`HTTP ${res.status} for ${src}`);
      const reader = res.body.getReader();
      let bytes = new Uint8Array();
      for (;;) {
        const { done, value } = await reader.read();
        if (value) {
          const next = new Uint8Array(bytes.length + value.length);
          next.set(bytes);
          next.set(value, bytes.length);
          bytes = next;
          try {
            const { width, height } = await imageMetadata(bytes, src);
            return { width, height };
          } catch {
            // Header not complete yet; keep reading.
          }
        }
        if (done) throw new Error(`Could not read image size of ${src}`);
      }
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  });
}
