import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://blog.weenas.com/",
    title: "川流不息",
    description: "Eason 的技术笔记：网络、工具、嵌入式开发与生活记录。",
    author: "Eason Xiang",
    profile: "https://github.com/easonxiang",
    ogImage: "default-og.jpg",
    lang: "zh",
    googleVerification: "Y6VubbWBGYz9tLmVTOoR4rcjThETjxR7fxVf4U6udIQ",
    bingVerification: "92DD827E38EA11E9EFB394F55CEACE8E",
    timezone: "Asia/Shanghai",
    dir: "ltr",
  },
  posts: {
    perPage: 8,
    perIndex: 8,
    scheduledPostMargin: 15 * 60 * 1000,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: true,
    showArchives: true,
    showBackButton: true,
    editPost: {
      enabled: false,
    },
    search: "pagefind",
  },
  socials: [
    { name: "github",   url: "https://github.com/easonxiang" },
    { name: "x",        url: "https://x.com/weenasw" },
    { name: "linkedin", url: "https://www.linkedin.com/in/easonxiang/" },
    { name: "mail",     url: "mailto:eason@weenas.com" },
  ],
  shareLinks: [
    { name: "x",        url: "https://x.com/intent/post?url=" },
    { name: "mail",     url: "mailto:?subject=See%20this%20post&body=" },
  ],
});
