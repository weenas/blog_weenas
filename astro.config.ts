import {
  defineConfig,
  envField,
  fontProviders,
  svgoOptimizer,
} from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { rehypeHeadingIds, unified } from "@astrojs/markdown-remark";
import rehypeCallouts from "rehype-callouts";
import rehypeExternalLinks from "rehype-external-links";
import rehypeLazyImages, { IMAGE_DOMAINS } from "./src/utils/rehype/lazyImages";
import { headingLinks } from "./src/utils/rehype/headingLinks";
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { transformerFileName } from "./src/utils/transformers/fileName";
import config from "./astro-paper.config";
import { DEFAULT_LOCALE, LOCALES, LOCALE_META } from "./src/i18n/locales";

export default defineConfig({
  site: config.site.url,
  integrations: [
    mdx(),
    sitemap({
      filter: page =>
        // noindex pages
        !/\/search\/$/.test(page) &&
        (config.features?.showArchives !== false ||
          !page.endsWith("/archives/")),
      i18n: {
        defaultLocale: DEFAULT_LOCALE,
        locales: Object.fromEntries(
          LOCALES.map(locale => [locale, LOCALE_META[locale].htmlLang])
        ),
      },
    }),
  ],
  i18n: {
    locales: [...LOCALES],
    defaultLocale: DEFAULT_LOCALE,
    // Every page is written once; `/zh/*` is rendered from the same route
    // with `Astro.currentLocale === "zh"`.
    fallback: { zh: DEFAULT_LOCALE },
    routing: {
      prefixDefaultLocale: false,
      fallbackType: "rewrite",
    },
  },
  markdown: {
    processor: unified({
      rehypePlugins: [
        rehypeCallouts,
        // Ids first so the permalinks below can point at them.
        rehypeHeadingIds,
        headingLinks,
        [
          rehypeExternalLinks,
          { target: "_blank", rel: ["noopener", "noreferrer"] },
        ],
        rehypeLazyImages,
      ],
    }),
    shikiConfig: {
      themes: { light: "min-light", dark: "night-owl" },
      defaultColor: false,
      wrap: false,
      transformers: [
        transformerFileName({ style: "v2", hideDot: false }),
        transformerNotationHighlight(),
        transformerNotationWordHighlight(),
        transformerNotationDiff({ matchAlgorithm: "v3" }),
      ],
    },
  },
  image: {
    // Post images live on the photo host; let Astro fetch and optimize them
    // (webp, srcset, width/height) at build time.
    domains: IMAGE_DOMAINS,
    layout: "constrained",
    responsiveStyles: true,
  },
  // Load pages on hover so navigation feels instant (works with ClientRouter).
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "hover",
  },
  vite: {
    plugins: [tailwindcss()],
  },
  fonts: [
    {
      name: "Google Sans Code",
      cssVariable: "--font-google-sans-code",
      provider: fontProviders.google(),
      fallbacks: ["monospace"],
      weights: [300, 400, 500, 600, 700],
      styles: ["normal", "italic"],
      // Variable woff2: one file per style covers every weight. OG images
      // load their own ttf subsets (see src/utils/loadGoogleFont.ts).
      formats: ["woff2"],
    },
  ],
  env: {
    schema: {
      PUBLIC_GOOGLE_SITE_VERIFICATION: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
    },
  },
  experimental: {
    svgOptimizer: svgoOptimizer(),
  },
});
