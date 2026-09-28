import { inferRemoteSize } from "astro/assets/utils/inferRemoteSize.js";

type Node = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: Node[];
};

/** Display width of post images: the `max-w-3xl` content column. */
const CONTENT_WIDTH = 768;

/** Hosts whose images Astro may fetch and optimize (also used in astro.config). */
export const IMAGE_DOMAINS = ["photo.weenas.com"];
const REMOTE_IMAGE_CONFIG = { domains: IMAGE_DOMAINS, remotePatterns: [] };

// Shared across posts: translations reuse the same images.
const sizeCache = new Map<string, Promise<{ width: number; height: number }>>();

function probe(src: string) {
  let size = sizeCache.get(src);
  if (!size) {
    size = inferRemoteSize(src, REMOTE_IMAGE_CONFIG);
    sizeCache.set(src, size);
  }
  return size;
}

/**
 * Prepares images in post bodies before Astro optimizes them:
 * - Remote images get width = min(content column, original) and the matching
 *   height, so Astro generates srcset sizes up to 2x the column (instead of up
 *   to the original, often 3000px+) with a correct `sizes` and aspect ratio.
 *   Animated GIFs get a single size, since every variant is megabytes.
 * - The first image loads eagerly (often above the fold); the rest lazily.
 */
export default function rehypeLazyImages() {
  return async (tree: Node) => {
    const images: Node[] = [];
    const collect = (node: Node) => {
      if (node.type === "element" && node.tagName === "img") images.push(node);
      node.children?.forEach(collect);
    };
    collect(tree);

    await Promise.all(
      images.map(async (img, index) => {
        const props = (img.properties ??= {});
        props.decoding ??= "async";
        props.loading ??= index === 0 ? "eager" : "lazy";

        const src = String(props.src ?? "");
        if (!/^https?:\/\//.test(src) || "width" in props) return;
        try {
          const original = await probe(src);
          const width = Math.min(CONTENT_WIDTH, original.width);
          props.width = width;
          props.height = Math.round((original.height * width) / original.width);
          // Animated GIFs become very large animated webp; one size is enough.
          if (/\.gif$/i.test(new URL(src).pathname)) props.widths = [width];
        } catch {
          // Leave it to Astro, which infers the original size itself.
        }
      })
    );
  };
}
