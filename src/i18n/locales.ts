export const LOCALES = ["en", "zh"] as const;
export type Locale = (typeof LOCALES)[number];

/** Locale served at the site root (no URL prefix). */
export const DEFAULT_LOCALE = "en" satisfies Locale;

/** Language assumed for posts without a `.en`/`.zh` suffix or `lang` field. */
export const DEFAULT_POST_LANG: Locale = "zh";

export const LOCALE_META: Record<Locale, { label: string; htmlLang: string }> =
  {
    en: { label: "English", htmlLang: "en" },
    zh: { label: "中文", htmlLang: "zh-CN" },
  };

export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}

export function toLocale(value: string | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Matches a trailing language suffix such as `foo.en` in a file name. */
export const LANG_SUFFIX_RE = new RegExp(`\\.(${LOCALES.join("|")})$`);
