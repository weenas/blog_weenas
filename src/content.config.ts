import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";
import config from "@/config";

export const BLOG_PATH = "src/content/posts";

const posts = defineCollection({
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: `./${BLOG_PATH}` }),
  schema: ({ image }) =>
    z
      .object({
        author: z.string().default(config.site.author),
        pubDatetime: z.coerce.date().optional(),
        // Legacy/Obsidian `date` field, used as a fallback for pubDatetime.
        date: z.coerce.date().optional(),
        modDatetime: z.coerce.date().optional().nullable(),
        title: z.string(),
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
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: "./src/content/pages" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    ogImage: z.string().optional(),
    canonicalURL: z.string().optional(),
  }),
});

export const collections = { posts, pages };
