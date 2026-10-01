import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";
import { slug as githubSlug } from "github-slugger";
import config from "@/config";
import { LANG_SUFFIX_RE, LOCALES } from "@/i18n/locales";

export const BLOG_PATH = "src/content/posts";

/**
 * Same as Astro's default id, except a language suffix (`foo.en.md`) is kept
 * as `foo.en` so translations of one entry share the same base id.
 */
function generateLocalizedId({
  entry,
  data,
}: {
  entry: string;
  data: Record<string, unknown>;
}): string {
  const withoutExt = entry.replace(/\.mdx?$/, "");
  const lang = withoutExt.match(LANG_SUFFIX_RE)?.[1];
  const base = data.slug
    ? String(data.slug)
    : withoutExt
        .replace(LANG_SUFFIX_RE, "")
        .split("/")
        .map(segment => githubSlug(segment))
        .join("/")
        .replace(/\/index$/, "");
  return lang ? `${base}.${lang}` : base;
}

const posts = defineCollection({
  loader: glob({
    pattern: "**/[^_]*.{md,mdx}",
    base: `./${BLOG_PATH}`,
    generateId: generateLocalizedId,
  }),
  schema: ({ image }) =>
    z
      .object({
        author: z.string().default(config.site.author),
        pubDatetime: z.coerce.date().optional(),
        // Legacy/Obsidian `date` field, used as a fallback for pubDatetime.
        date: z.coerce.date().optional(),
        modDatetime: z.coerce.date().optional().nullable(),
        title: z.string(),
        // Post language; a `.en`/`.zh` file suffix takes precedence.
        lang: z.enum(LOCALES).optional(),
        featured: z.boolean().optional(),
        draft: z.boolean().optional(),
        // Obsidian may write tags as a string, a list, or leave it empty.
        tags: z
          .union([z.array(z.coerce.string()), z.string(), z.null()])
          .optional()
          .transform(val => {
            if (Array.isArray(val) && val.length > 0) return val;
            if (typeof val === "string" && val.trim()) return [val.trim()];
            return ["uncategorized"];
          }),
        // Cover image (URL), shown as the post card thumbnail. Obsidian may
        // leave the key empty.
        image: z
          .string()
          .nullable()
          .optional()
          .transform(val => val?.trim() || undefined),
        ogImage: image().or(z.string()).optional(),
        description: z.string(),
        canonicalURL: z.string().optional(),
        hideEditPost: z.boolean().optional(),
        timezone: z.string().optional(),
      })
      .transform(({ date, pubDatetime, ...rest }, ctx) => {
        const published = pubDatetime ?? date;
        if (!published) {
          ctx.addIssue({
            code: "custom",
            message: "Either `pubDatetime` or `date` is required.",
          });
          return z.NEVER;
        }
        return { ...rest, pubDatetime: published };
      }),
});

const pages = defineCollection({
  loader: glob({
    pattern: "**/[^_]*.{md,mdx}",
    base: "./src/content/pages",
    generateId: generateLocalizedId,
  }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    ogImage: z.string().optional(),
    canonicalURL: z.string().optional(),
  }),
});

export const collections = { posts, pages };
