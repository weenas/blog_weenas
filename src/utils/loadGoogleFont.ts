const cache = new Map<string, Promise<ArrayBuffer>>();

/**
 * Fetch a Google Font subset that only contains the glyphs in `text`.
 * Used for CJK fallback in OG images, where a full font would be too large.
 */
export function loadGoogleFont(
  family: string,
  weight: number,
  text: string
): Promise<ArrayBuffer> {
  const glyphs = [...new Set(text)].join("");
  const key = `${family}:${weight}:${glyphs}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const promise = (async () => {
    const cssUrl =
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}` +
      `:wght@${weight}&text=${encodeURIComponent(glyphs)}`;
    const css = await fetch(cssUrl).then(res => res.text());
    const fontUrl = css.match(
      /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/
    )?.[1];

    if (!fontUrl) {
      throw new Error(`Failed to resolve font "${family}" from Google Fonts.`);
    }

    const res = await fetch(fontUrl);
    if (!res.ok) {
      throw new Error(`Failed to download font "${family}": ${res.status}`);
    }
    return res.arrayBuffer();
  })();

  cache.set(key, promise);
  promise.catch(() => cache.delete(key));
  return promise;
}
