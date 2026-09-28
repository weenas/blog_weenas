import type { CollectionEntry } from "astro:content";
import {
  DEFAULT_LOCALE,
  DEFAULT_POST_LANG,
  LANG_SUFFIX_RE,
  type Locale,
} from "@/i18n/locales";
import { getPostSlug } from "./getPostPaths";
import { postFilter } from "./postFilter";

type Post = CollectionEntry<"posts">;

/** Language of a post: `.en`/`.zh` file suffix, then `lang`, then default. */
export function getPostLang(post: Post): Locale {
  const suffix = post.id.match(LANG_SUFFIX_RE)?.[1] as Locale | undefined;
  return suffix ?? post.data.lang ?? DEFAULT_POST_LANG;
}

/** Key shared by all translations of a post (its URL path). */
export function getTranslationKey(post: Post): string {
  return getPostSlug(post.id, post.filePath);
}

// Drafts and scheduled posts are skipped so an unfinished translation never
// hides the published original.
function groupTranslations(posts: Post[]): Map<string, Post[]> {
  const groups = new Map<string, Post[]>();
  for (const post of posts.filter(postFilter)) {
    const key = getTranslationKey(post);
    groups.set(key, [...(groups.get(key) ?? []), post]);
  }
  return groups;
}

function pickVersion(versions: Post[], locale: Locale): Post {
  return (
    versions.find(post => getPostLang(post) === locale) ??
    versions.find(post => getPostLang(post) === DEFAULT_POST_LANG) ??
    versions[0]
  );
}

/**
 * Collapses translations so each post appears once, preferring the version
 * written in `locale` and falling back to the original.
 */
export function localizePosts(posts: Post[], locale: Locale): Post[] {
  return [...groupTranslations(posts).values()].map(versions =>
    pickVersion(versions, locale)
  );
}

/** Returns the version of `post` that best matches `locale`. */
export function localizePost(post: Post, posts: Post[], locale: Locale): Post {
  const key = getTranslationKey(post);
  const versions = posts
    .filter(postFilter)
    .filter(p => getTranslationKey(p) === key);
  return versions.length > 0 ? pickVersion(versions, locale) : post;
}

/** Localized posts for building static paths (same paths for every locale). */
export function localizePostsForPaths(posts: Post[]): Post[] {
  return localizePosts(posts, DEFAULT_LOCALE);
}
