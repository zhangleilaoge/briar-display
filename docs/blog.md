# 个人博客

- 页面 `/briar/blog/`（列表，按年分组）+ `/briar/blog/{slug}/`（详情），纯静态、**无登录**、无后端 API
- 文章放在 `packages/briar-display/src/content/blog/*.md`（Astro content collection，glob loader；文件名即 slug，建议英文短横线命名），frontmatter：`title` / `date` / `description?` / `tags?` / `draft?`（draft: true 不发布）；写完 `git push` 走 CI 即上线
- 布局 `src/layouts/BlogLayout.astro`，样式集中在 `src/styles/blog.css`（暖纸 + 朱砂主题，`prefers-color-scheme: dark` 自动切墨黑 + 金）；字数/阅读时长工具在 `src/lib/blog.ts`
- 站点名/签名在 `src/pages/briar/blog/index.astro` 顶部 `BLOG_NAME` / `BLOG_SLOGAN` 常量

## 超管编辑预览

详情页构建时把 md 原文内嵌为 `#blog-md-source` JSON，超管登录后右下角出现悬浮按钮（`src/components/blog/BlogEditorLauncher.tsx`），点开全屏「左预览（react-markdown）右编辑」。编辑的是含 frontmatter 的完整 md（自研极简解析器尽力解析 `title`/`date`/`tags`，中间态按无 frontmatter 渲染），仅预览不保存；复制原样输出，支持重置/清空粘贴任意 md。代码块无 Shiki 高亮属预期差异。
