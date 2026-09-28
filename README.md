# Weenas Blog

Eason 的个人技术博客：网络、工具、嵌入式开发与生活记录。

- 网站：<https://blog.weenas.com>（英文）/ <https://blog.weenas.com/zh/>（中文）
- 基于 [Astro](https://astro.build/)，主题改自 [AstroPaper](https://github.com/satnaing/astro-paper)，部署在 Cloudflare Pages

## 本地开发

需要 Node.js 22.12 或更高版本。

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # 类型检查 + 构建 + 生成搜索索引
npm run preview    # 预览构建结果
```

提交前可以运行 `npm run lint` 和 `npm run format:check`，CI 会执行同样的检查。

> 开发模式下 `/zh/posts/<slug>/` 会返回 404（Astro 开发服务器的限制），构建后正常。本地写作时用英文地址 `/posts/<slug>/` 预览即可。

## 写文章

文章放在 `src/content/posts/<分类>/`，子目录名会成为网址的一部分，例如 `tools/vim_usage.md` → `/posts/tools/vim_usage/`。文件名以 `_` 开头的不会发布（`_template.md` 是模板）。

```yaml
---
title: 文章标题
description: 一句话描述（用于列表、搜索引擎和分享卡片）
pubDatetime: 2026-09-28 # 发布日期；也可以只写 date
modDatetime: 2026-10-01 # 可选，修改日期，会显示“更新于”
tags:
  - tools
image: https://... # 可选，封面图
draft: false # true 时不发布
---
```

- 用 `##` / `###` 写小节标题，文章页会自动生成目录（至少 3 个小节时显示）。
- 没有设置 `ogImage` 的文章会自动生成分享预览图。

### 中英双语

- 英文站在根路径 `/`，中文站在 `/zh/`，页面右上角可以切换语言。
- 给文章加英文版：在原文旁边放一个同名的 `.en.md` 文件，例如 `vim_usage.md` + `vim_usage.en.md`，两个版本共用同一个网址。
- 没有后缀的文章默认是中文；如果原文是英文，在 frontmatter 里加 `lang: en`。
- 某种语言没有对应版本时，会显示原文并提示读者。
- 「关于」页面同理：`src/content/pages/about.md`，可用 `about.en.md` / `about.zh.md` 覆盖。

## 目录结构

```text
astro-paper.config.ts   站点信息、社交链接、功能开关
astro.config.ts         Astro 配置（i18n、Markdown、字体、图片等）
public/                 原样发布的静态文件（图标、_headers、_redirects）
src/content/posts/      文章
src/content/pages/      独立页面（关于）
src/i18n/               界面文案与语言配置
src/pages/              路由
```

## 发布

推送到 `master` 后，Cloudflare Pages 会自动构建并发布。修改建议走 PR：CI（lint、格式检查、构建）通过后自动合并。
