import type { CollectionEntry } from "astro:content";
import config from "@/config";

/**
 * Determines whether a post is eligible to be listed/rendered.
 *
 * - In dev, includes drafts so authors can preview unpublished posts
 * - In production, excludes drafts and scheduled posts until `pubDatetime` minus the configured margin
 */
export function postFilter({ data }: CollectionEntry<"posts">) {
  const isPublishTimePassed =
    Date.now() >
    new Date(data.pubDatetime).getTime() - config.posts.scheduledPostMargin;
  return (
    (import.meta.env.DEV || !data.draft) &&
    (import.meta.env.DEV || isPublishTimePassed)
  );
}
