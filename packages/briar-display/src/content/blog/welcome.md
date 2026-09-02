---
title: 欢迎来到我的博客
date: 2026-08-18
description: 这个博客如何工作，以及如何发布一篇新文章
tags: [随笔]
---

这里是我的个人博客，用来记录一些想法、笔记和随笔。这里没有在线编辑器，也不追求严谨的知识结构——写文章就是往仓库里丢一个 Markdown 文件，然后重新部署。

## 如何发布一篇新文章

在 `packages/briar-display/src/content/blog/` 目录下新建一个 `.md` 文件，文件名就是文章的 URL（建议用英文短横线命名，比如 `my-first-post.md` 对应 `/briar/blog/my-first-post/`）。

文件顶部写 frontmatter：

```yaml
---
title: 文章标题
date: 2026-08-18
description: 一句话简介（可选，用于 meta description）
tags: [标签一, 标签二]
draft: false
---
```

然后照常 `git push`，CI 会自动构建部署，文章就上线了。

## 支持的排版

正文就是标准 Markdown（GFM）。标题、列表、引用、代码块、表格、图片都可以正常使用：

> 样式已经预置好了——首字下沉、引用块、代码高亮、图片阴影，都不需要额外操心。

- 列表项会自动带上主题色标记
- 代码块有语法高亮
- 文章底部自动生成「更早 / 更新」导航

写完想看看效果？`make dev` 起本地服务，访问 `/briar/blog/` 即可。
