import { imageMetadata } from "astro/assets/utils";

/** Hosts whose images Astro may fetch and optimize (used in astro.config). */
export const IMAGE_DOMAINS = ["photo.weenas.com", "cmake.org"];

const ATTEMPTS = 4;
const TIMEOUT_MS = 60_000;
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
 * here with timeouts and retries, and hand Astro an already-buffered response.
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
    return withRetry(async () => {
      const req = input instanceof Request ? input.clone() : input;
      const res = await realFetch(req, {
        ...init,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const body = [204, 304].includes(res.status)
        ? null
        : await res.arrayBuffer();
      const outHeaders = new Headers(res.headers);
      // The body is already decoded and complete.
      outHeaders.delete("content-encoding");
      outHeaders.delete("content-length");
      return new Response(body, {
        status: res.status,
        statusText: res.statusText,
        headers: outHeaders,
      });
    });
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
