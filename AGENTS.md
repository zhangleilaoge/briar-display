# Briar Display — Agent Guide

## 项目概述

Briar Display 是一个基于 bun workspace 的 monorepo：

- **前端** (`@briar/display`)：Astro + React + Vue + TailwindCSS，部署在 `/briar/` 子路径
- **后端** (`@briar/node`)：Hono + MySQL2，端口 `3888`
- **共享库** (`@briar/shared`)：TypeScript 常量、类型和工具函数
- **脚本** (`@briar/scripts`)：构建辅助脚本

线上地址：`https://xiaobuzi.cn/briar/`

| 包 | 关键技术 |
| :--- | :--- |
| `@briar/shared` | TypeScript, tsup |
| `@briar/display` | Astro, React, Vue, TailwindCSS, axios |
| `@briar/node` | Hono, MySQL2, JWT, bcryptjs |
| `@briar/scripts` | TypeScript |

## 开发工作流

使用 **Bun**，workspaces 在根目录 `package.json`。

**构建顺序**（display 和 node 都依赖 shared，必须先构建）：

```bash
bun run --filter @briar/shared build && bun run --filter @briar/display build && bun run --filter @briar/node build
```

常用命令见 `Makefile`（`make dev` / `make build` / `make lint`）。

**代码规范**：Biome（见 `biome.json`）+ Lefthook（pre-commit: check + typecheck）。Tab 缩进、单引号、尾逗号、分号按需。

**文件大小限制**：任何超过 600 行的非配置文件都需要考虑逻辑拆分。优先将纯逻辑（工具函数、计算、解析）抽离到独立的 utils 文件，UI 组件拆分为独立子组件，保持主文件聚焦于状态管理和布局编排。

**UI 组件**：优先使用 shadcn/ui 组件（`@/components/ui/`），不要用原生 HTML 元素（`<select>`、`<input>`、`<dialog>` 等）。Radix Select、Input、Button、Dialog 等已配好样式。下拉框、搜索框、选择器等交互组件必须使用 shadcn 组件（如 Select、Command+Popover 组合的 Combobox），确保支持键盘导航（↑↓ 切换、Enter 确认、Esc 关闭）。面包屑使用 `Breadcrumb` 组件，页面切换导航使用 `Tabs` 组件，禁止硬编码面包屑文本或自定义按钮组模拟 tab 样式。错误提示、成功反馈等消息禁止使用 `alert()`/`confirm()`，统一使用 `sonner` 的 `toast()`/`toast.error()`/`toast.success()`（已全局挂载 Toaster，直接 `import { toast } from 'sonner'` 即可）。

## 重要文件路径

| 文件 | 作用 |
| :--- | :--- |
| `packages/briar-node/src/index.ts` | 后端入口，注册中间件和路由 |
| `packages/briar-node/src/routes/api.ts` | API 路由汇总 |
| `packages/briar-node/src/routes/admin.ts` | Admin API（角色/权限/用户/日志） |
| `packages/briar-node/src/middleware/config.ts` | 全局中间件配置 |
| `packages/briar-node/src/middleware/apiWriteGuard.ts` | 全局写操作安全网（默认拒绝未声明的写路由） |
| `packages/briar-node/src/config/routes.ts` | 公开路径白名单（控制 JWT 验证跳过） |
| `packages/briar-node/src/config/apiPermissions.ts` | 全局写路由权限映射表（**新增写路由必须在此注册**） |
| `packages/briar-shared/src/constants.ts` | 共享常量（`API_BASE_PATH`、`NODE_PORT`） |
| `packages/briar-shared/src/permissions.ts` | 权限编码常量和分组 |
| `packages/briar-display/src/api/request.ts` | 前端 axios 实例，baseURL 自动计算 |
| `packages/briar-node/src/routes/terminalWs.ts` | SSH 控制台 WebSocket 桥接（`/api/terminal/ws`，挂 http server upgrade，cookie/token 鉴权 + `admin:terminal:access` 权限 + 设备令牌）：ssh2 连 `DEPLOY_HOST`，`DEPLOY_KEY_PATH` 私钥优先、否则 `DEPLOY_PASS`；命令行审计落 `terminal_audit_logs` |
| `packages/briar-node/src/routes/terminal.ts` | SSH 控制台 HTTP API（`/api/terminal`）：发设备验证码、验码签 7 天设备令牌、服务器信息采集（host-info） |
| `packages/briar-node/src/services/terminalService.ts` | 终端服务：验证码/设备令牌签发校验、ssh2 采集服务器信息（10s 缓存）、`resolveDeployKeyPath` |
| `packages/briar-node/src/routes/version.ts` | `/api/version` 版本指纹接口（前后端一致性校验） |
| `packages/briar-node/src/routes/files.ts` | 文件管理 API（`/api/files`，原图床）：上传 precheck/cos-sign/confirm、文件夹 CRUD、文本预览代理 |
| `packages/briar-display/src/api/files.ts` | 前端文件 API + cos-js-sdk-v5 分片直传封装 |
| `packages/briar-node/src/routes/messages.ts` | 站内信 API（`/api/messages`）：列表/未读数/标记已读 |
| `packages/briar-node/src/routes/media.ts` | 媒体解析 API（`/api/media`，工具箱「媒体解析」，免登录 + IP 限频 parse 6/min、proxy 120/min，超管豁免）：`POST /parse` 支持小红书（转发 catsapi）、抖音（自研解析，见 douyinMediaService）、微信公众号文章（自研解析，见 wechatMediaService）、B站（自研解析，见 bilibiliMediaService）和 X/Twitter（fxtwitter 公共 API）；`GET /proxy` 媒体代理（白名单 xhscdn/qpic/tc.qq/douyin 系/zjcdn/twimg/bilivideo/hdslb 等），旁路缓存——inline 预览透传 Range 不缓存，下载（非 inline）拉全量 tee 到 COS 公有桶，hit 302 直发（文件名在对象 key 末段）。twimg 国内服务器不可达：前端对 twimg 直连（CORS 开放，需访客有梯子），代理仅海外环境可用 |
| `packages/briar-node/src/services/douyinMediaService.ts` | 抖音自研解析（catsapi 抖音通道 2026-09 起持续 502 弃用）：短链手动跟 302 取 aweme_id → ttwid 游客凭证 + a_bogus 签名 → `douyin.com/aweme/v1/web/aweme/detail/`。视频 play_addr 即无水印；图集 images[].url_list；动态照片 images[].video.play_addr；音轨 music.play_url。Argus 风控概率拦截（403 Uifid/空 body）时换 fresh ttwid 重试 3 次；审核中/已删除（filter_reason）报「作品不存在、已删除或仅作者本人可见」。签名实现：`lib/sm3.ts`（国密 SM3，OpenSSL 测试向量验证）+ `lib/aBogus.ts`（SDK 1.0.1.5 变体盐 "cus"，与 Evil0ctal abogus.py 逐字节对齐；UA 与 UA_CODE 绑定勿单改） |
| `packages/briar-node/src/services/mediaCacheService.ts` | 媒体缓存：`media_parse_cache` 按人（u:{userId}/ip:{IP}）LRU 10 条存解析结果（淘汰连带清对应媒体；抖音签名 URL 时效不足半小时，缓存超 10 分钟视为失效，proxy 遇上游 403 也会删掉对应缓存让「重新解析」生效）；`media_cache` 记录 COS 旁路缓存（每条解析记录累计 ≤50MB 才缓存）；`cleanupExpiredMedia` 清 7 天前媒体（解析结果保留） |
| `packages/briar-node/src/jobs/cleanup-media-cache.mjs` | 媒体缓存清理定时任务（每日 05:23，`BRIAR_CLEANUP_MEDIA_CRON` 可覆盖） |
| `packages/briar-node/src/services/wechatMediaService.ts` | 公众号文章解析：正则解析 HTML（og:title/author 元信息、图片消息 `picture_page_info_list` 的 cdn_url + 实况图 format_info 取最大档、图文 `#js_content` img、视频 videoplayer 二次请求取 url_info） |
| `packages/briar-node/src/services/bilibiliMediaService.ts` | B站自研解析：b23.tv 短链跟 302 → BV/av 号 → `web-interface/view` 拿标题/UP主/封面/分P → `player/playurl` 取流（优先 html5 通道 muxed mp4 免登录 720P，无 durl 回退 DASH 视频/音频分离 1080P）；播放地址签名时效约 30 天，解析缓存不做短时效处理；bilivideo CDN 只校验浏览器 UA、不校验 Referer，代理直连均可 |
| `packages/briar-node/src/services/fileModerationService.ts` | 图片封禁检测：定时扫描 CDN URL（403/451 判定被封）→ 删记录 + 清理 COS + 发站内信 |
| `packages/briar-node/src/jobs/scan-blocked-files.mjs` | 封禁扫描定时任务（cron 见 schedulerConfig，`BRIAR_SCAN_BLOCKED_CRON` 可覆盖） |
| `packages/briar-node/src/routes/scheduler.ts` | 定时任务管理 API（`/api/scheduler`）：任务列表（含最近运行记录）、手动触发 |
| `packages/briar-node/src/lib/schedulerConfig.ts` | 定时任务注册表（唯一事实来源），新增任务在此注册后管理卡片自动展示 |
| `packages/briar-node/src/services/schedulerRunService.ts` | `runWithLog`：执行包装器，定时/手动运行统一落 `scheduler_runs` 表 |
| `packages/briar-display/src/hooks/useUnreadMessages.ts` | 站内信未读数 hook（60s 轮询），UserMenu 红点与菜单角标共用 |
| `packages/briar-display/src/components/profile/MessagesPanel.tsx` | 站内信面板（个人中心「站内信」页签）：分页列表 + 详情弹窗 |
| `packages/briar-scripts/scripts/write-version.ts` | 构建时写入 `version.json` 的脚本 |
| `.github/workflows/deploy.yml` | CI：构建前端 + 上传 CDN + SSH 部署后端 + 健康检查 |
| `default.conf` | Nginx 配置 |
| `ecosystem.config.cjs` | PM2 配置（cwd 为绝对路径） |

## 路由架构

前端页面在 `packages/briar-display/src/pages/briar/`，后端 API 在 `packages/briar-node/src/routes/`。

### Nginx 代理

- `/` → `http://127.0.0.1:3888/`（根路径落地页，备案合规，源码 `packages/briar-node/src/routes/root.ts`）
- `/robots.txt` → nginx 直接返回（`Disallow: /api/`，拦 AI 爬虫嗅探，不进 node 不落日志）
- `/briar/` → `http://127.0.0.1:3888`（后端提供静态资源 + fallback）
- `/api/` → `http://127.0.0.1:3888/api/`

### 文件管理（原图床）

- 页面 `/briar/files`（旧 `/briar/images/*` 重定向至此），API `/api/files`
- **双 bucket**：公开桶 `BRIAR_TX_BUCKET_NAME` 放前端静态资源和头像；用户文件（`files/` 前缀）放私有读桶 `BRIAR_TX_PRIVATE_BUCKET_NAME`，**访问一律走后端签名 URL**（`cosService.signFileUrls`，8 天有效，读取时按 `filename` 现算，DB 留存的 `cdn_url`/`thumbnail_url` 裸 URL 不外发；签名 KeyTime 按 7 天窗口对齐（`KEYTIME_WINDOW`），同一窗口内含 PM2 重启后 URL 完全一致，浏览器缓存可跨部署存活，进程内缓存仅用于避免重复计算）
- 浏览器缓存：对象上传时写 `Cache-Control: max-age=2592000`（cosKey 带随机 id 内容不可变）；静态资源由 upload-cdn.ts 设一年 immutable；存量对象补 header 用 `bun run --filter @briar/scripts cos:cache-control`（幂等）
- 上传走**前端分片直传 COS**（私有桶）：`POST /api/files/precheck`（配额/去重/发 cosKey）→ cos-js-sdk-v5 `sliceUploadFile` 直传（分片签名由 `POST /api/files/cos-sign` 下发，仅放行 `files/{userId}/` 前缀）→ `POST /api/files/confirm` 写库。文件不经过 nginx/服务器，`client_max_body_size 10m` 不影响上传
- 直传依赖 COS bucket CORS，一次性配置（覆盖双桶）：`make cos-cors`
- 存量文件从公开桶迁到私有桶：`make cos-migrate-files`（幂等，不删源桶）
- 封禁扫描（fileModerationService）必须签 URL 再 fetch：私有桶未签名恒 403，直接 fetch 裸 URL 会把全部图片误判为封禁并删除
- 视频封面：上传完成后客户端用 video+canvas 截首帧，直传为 `{cosKey去扩展名}.cover.jpg` 并在 confirm 时传 `thumbnailKey`；网格有封面用 `<img>`，存量无封面视频 fallback 到 `<video preload="metadata">`；删除文件/文件夹时连带删封面
- 数据表：`files`（原 `images` 表改名）+ `folders`（嵌套文件夹），迁移见 `migrate.sql`

### 个人博客

- 页面 `/briar/blog/`（列表，按年分组）+ `/briar/blog/{slug}/`（详情），纯静态、**无登录**、无后端 API
- 文章放在 `packages/briar-display/src/content/blog/*.md`（Astro content collection，glob loader；文件名即 slug，建议英文短横线命名），frontmatter：`title` / `date` / `description?` / `tags?` / `draft?`（draft: true 不发布）；写完 `git push` 走 CI 即上线
- 布局 `src/layouts/BlogLayout.astro`，样式集中在 `src/styles/blog.css`（暖纸 + 朱砂主题，`prefers-color-scheme: dark` 自动切墨黑 + 金）；字数/阅读时长工具在 `src/lib/blog.ts`
- 站点名/签名在 `src/pages/briar/blog/index.astro` 顶部 `BLOG_NAME` / `BLOG_SLOGAN` 常量
- 超管编辑预览：详情页构建时把 md 原文内嵌为 `#blog-md-source` JSON，超管登录后右下角出现悬浮按钮（`src/components/blog/BlogEditorLauncher.tsx`），点开全屏「左预览（react-markdown）右编辑」；编辑的是含 frontmatter 的完整 md（自研极简解析器尽力解析 `title`/`date`/`tags`，中间态按无 frontmatter 渲染），仅预览不保存；复制原样输出，支持重置/清空粘贴任意 md；代码块无 Shiki 高亮属预期差异

### SSH 控制台

- 页面 `/briar/admin/terminal`（AdminLayout 侧边栏「SSH 控制台」），前端 xterm.js（**必须动态 import**，静态导入 CJS 包会让 Astro build 失败）；多标签会话（每个 tab 独立 WS + SSH 连接，切换仅隐藏容器保持存活）
- WS 端点 `/api/terminal/ws`，nginx 需转发 Upgrade 头（`default.conf` 已配，改动后手动 `./scripts/deploy-nginx.sh`）
- SSH 目标复用 `DEPLOY_*` 环境变量；**`.env` 需配 `DEPLOY_KEY_PATH`**（指向私钥，相对路径基于仓库根目录解析，如 `briar-assets/ssh/xiaobuzi.pem`，本地/服务器同值通用；`briar-assets/briar/.env` 已配，`make init` 会带出来），否则回退 `DEPLOY_PASS` 密码（当前服务器密码已失效，仅密钥可用）
- 权限 `admin:terminal:access`（admin 角色已授权），所有会话的命令行输入落 `terminal_audit_logs` 审计表
- **设备授权**：使用前需邮箱验证码验证（复用通用验证码邮件模板），验码通过签发 7 天设备令牌（JWT，purpose=`terminal-device`，存前端 localStorage `briar_terminal_device`）；WS 连接与 `/api/terminal/host-info` 均强校验设备令牌
- 页面顶部有服务器信息面板（`/api/terminal/host-info`，ssh2 采集系统/CPU 负载/内存/硬盘，10s 缓存，前端 15s 轮询）

## 已知陷阱

已拆分到 [`docs/pitfalls.md`](docs/pitfalls.md)，新陷阱追加到该文件末尾并递增编号。

## RBAC 权限系统

RBAC 模型：`用户 → 角色 → 权限`（`user_roles` + `role_permissions`）。

| 角色 | 标识 | 权限范围 |
| :--- | :--- | :--- |
| 普通用户 | `user` | 访问业务页面（`page:business`） |
| 管理员 | `moderator` | 预留（当前无额外权限） |
| 超级管理员 | `admin` | + 管理后台，自动放行所有检查 |

权限编码格式：`{模块}:{资源}:{操作}`（如 `admin:role:manage`）。

前端使用 `useRequirePermission` hook 或 `<PermissionGuard>` 组件。

### 安全架构：两层防线

**第一层：authMiddleware + routes.ts（谁能访问）**
- `routes.ts` 中的 `API_UNRESTRICTED_PATHS` 控制哪些路径跳过 JWT 验证（如登录/注册）
- `API_PUBLIC_PATHS` / `API_PUBLIC_PREFIXES` 控制 GET 请求的公开访问（如 `/api/version`）

**第二层：apiWriteGuard + apiPermissions.ts（能做什么）**
- 全局中间件，拦截所有 POST/PUT/PATCH/DELETE 请求
- `apiPermissions.ts` 是统一的写路由权限映射表
- 已声明 → 检查权限；标记 null → 公开放行；未声明 → **默认拒绝（403）+ 控制台警告**

**新增写路由时必须在 `apiPermissions.ts` 中注册**，否则会被拦截。这是故意设计的安全网。

## 部署

**自动部署**：`git push` 到 master/main → GitHub Actions 一条流水线完成：
构建前端 + 上传 CDN → rsync 到服务器 `web/` → SSH 调用 `deploy.sh`（清理工作区、更新代码、build shared+node、migrate、写 version、PM2 重启）→ 健康检查 `GET /api/version`（8 次重试，中途自动 `pm2 resurrect` 兜底）→ 记录到 `briar-assets/deploy-history.jsonl`。

**触发范围**：CI 仅对 `packages/briar-{node,display,shared,scripts}`、`scripts/deploy.sh` 及根构建文件（`package.json`/`bun.lock`/`Makefile`/`biome.json`）的改动触发；其他改动（如 briar-agent、briar-skills、docs）不触发，如需部署可在 Actions 页面手动 `workflow_dispatch`。

| 修改内容 | 执行 |
| :--- | :--- |
| `packages/briar-node/src/**/*.ts` | git push，CI 自动部署（含 migrate） |
| `packages/briar-display/src/**/*.{tsx,astro}` | git push，CI 自动同步 |
| `packages/briar-shared/src/**/*.ts` | git push，CI 自动（deploy.sh 默认 build shared+node） |
| `default.conf` | `./scripts/deploy-nginx.sh`（手动） |
| `.env` | `pm2 restart briar-node`（手动，.env 不在 git） |

**手动兜底**：服务器上 `./scripts/deploy.sh`（支持 `--skip-install`/`--skip-build`/`--full-build`，支持 `DEPLOY_COMMIT=<sha>` 精确部署）。同步代码前会 `git reset --hard` + `git clean -fd`（跳过 .gitignore 内容与 `packages/briar-node/jobs` 构建产物，不碰子模块），保证工作区干净。

**PM2 开机自启**：已配置 `pm2 startup`（systemd unit `pm2-ubuntu`，enabled）+ `pm2 save`，服务器重启后自动恢复进程。

**版本校验**：访问 `https://xiaobuzi.cn/api/version` 查看 `backend.commit` 与 `frontend.commit` 是否一致。

**所需 GitHub Secrets**：`DOCKER_GITHUB_TOKEN`、`DEPLOY_KEY`、`DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_REMOTE_DIR`（默认 `~/github/briar-display/packages/briar-display/web`）、`DEPLOY_PROJECT_DIR`（默认 `~/github/briar-display`）、`BRIAR_TX_*`（CDN）。

## AI 排查日志

直接查数据库，不要翻 .log 文件：

```sql
SELECT * FROM request_logs WHERE trace_id = 'xxx';
SELECT * FROM request_logs WHERE status >= 400 ORDER BY created_at DESC LIMIT 20;
```

`request_logs` 含 `request_params`（脱敏）、`response_body`（脱敏 + 截断 2000 字符）、`error_message`、`error_stack`（未捕获异常）。代码里主动打的 `console.*` 会被 `lib/logger.ts` 的 `patchConsoleWithTrace` 自动加上 `[traceId]` 前缀（ALS 注入，traceIdMiddleware 包住请求链），PM2 日志可 `grep '<traceId>'` 关联一个请求的全部日志。敏感字段（token/password 等 key）入库前由 `redactSensitive` 替换为 `***`。

`request_logs` 保留 90 天，定时任务 `cleanup-request-logs` 每日清理（`BRIAR_CLEANUP_LOGS_CRON` 可覆盖）。

或 API：`GET /api/admin/logs?statusGroup=5xx&limit=20`（关键词搜索覆盖路径/参数/响应体/错误/trace）

管理页面：`/briar/admin/logs`
