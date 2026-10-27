# Briar Display — Agent Guide

## 项目概述

Briar Display 是一个基于 bun workspace 的 monorepo，线上地址 `https://xiaobuzi.cn/briar/`：

- **前端** (`@briar/display`)：Astro + React + Vue + TailwindCSS + axios，部署在 `/briar/` 子路径
- **后端** (`@briar/node`)：Hono + MySQL2 + JWT + bcryptjs，端口 `3888`
- **共享库** (`@briar/shared`)：TypeScript 常量、类型和工具函数（tsup 构建）
- **脚本** (`@briar/scripts`)：构建辅助脚本

## 开发工作流

使用 **Bun**，workspaces 在根目录 `package.json`。

**构建顺序**（display 和 node 都依赖 shared，必须先构建）：

```bash
bun run --filter @briar/shared build && bun run --filter @briar/display build && bun run --filter @briar/node build
```

常用命令见 `Makefile`（`make dev` / `make build` / `make test`）。

**测试**：后端 `bun run --filter @briar/node test`（bun test，纯逻辑 + 路由权限契约，不碰数据库）；测试文件放各自包源码旁的 `*.test.ts`（briar-scripts/bid-compare 的测试只维护在其自己目录）。CI 在构建前跑后端测试。

**代码规范**：Biome（见 `biome.json`）+ Lefthook（pre-commit: check + typecheck）。Tab 缩进、单引号、尾逗号、分号按需。

**文件大小限制**：任何超过 600 行的非配置文件都需要考虑逻辑拆分。优先将纯逻辑（工具函数、计算、解析）抽离到独立的 utils 文件，UI 组件拆分为独立子组件，保持主文件聚焦于状态管理和布局编排。

**UI 组件**：优先使用 shadcn/ui 组件（`@/components/ui/`），不要用原生 HTML 元素（`<select>`、`<input>`、`<dialog>` 等）。下拉框、搜索框、选择器等交互组件必须使用 shadcn 组件（如 Select、Command+Popover 组合的 Combobox），确保支持键盘导航（↑↓ 切换、Enter 确认、Esc 关闭）。面包屑使用 `Breadcrumb` 组件，页面切换导航使用 `Tabs` 组件。错误提示、成功反馈等消息禁止使用 `alert()`/`confirm()`，统一使用 `sonner` 的 `toast()`（已全局挂载 Toaster）。

## 前端页面自验（快速路径）

目标是用最少步骤取得本次改动的可信证据，不做全站巡检，不重复实现阶段已完成的调查。纯文档修改只需要检查 diff，不需要浏览器或全量构建。

1. **动手前先列验收矩阵**：把用户说的「全部 / 所有」展开成用户可见的功能项，写清每项的入口、预期结果和 1–3 个可观察断言（路由、核心内容、关键数据或交互）。例如「港股全部去掉固定 15 分钟延迟」至少要核对报价、自选、分时、五日、日 / 周 / 月 K，以及失败降级是否重新引入延迟源；不能打开一次页面就宣称全部完成。实现和交付都按矩阵核销，只覆盖本次需求，不顺手扩大范围。
2. **全量检查只在最终状态跑一轮**：修改过程中只跑相关测试或检查。代码定稿后，前端改动运行 `bun run typecheck`、`bun run lint`，在 `packages/briar-display` 运行 `bun test`，交付前在根目录 `bun run build`；涉及 shared/node 时按上文完整构建并运行后端测试。失败后先定位和修复，只重跑失败项及受影响的最终检查，不为同一状态重复全套。
3. **浏览器之前先配对构建和 API，只启动一套最终产物环境**：
   - 先构建 shared，再用 `BUILD_DEV=true bun run --filter @briar/display build` 构建本地验收产物。它会关闭 CDN `assetsPrefix`，避免页面加载尚未上传的 JS；**不会改变 API 地址**。
   - 只验外壳：在 `packages/briar-display` 后台运行 `bun run preview --host 127.0.0.1 --port 43988`，不启动后端、数据库或调度器；没有可用 API 时只能声称外壳已验证。
   - 需要真实 API：3888 空闲时启动 `PORT=3888 NODE_ENV=development BRIAR_ENABLE_SCHEDULER=0 bun run --filter @briar/node start`，访问同源的 `http://127.0.0.1:3888/briar/...`。只在确认已有服务属于当前仓库且使用当前构建时才复用。
   - 端口被占用：不杀不明确的进程，改用高端口；跨端口预览必须在构建时设置 `PUBLIC_API_BASE_URL=http://127.0.0.1:<API端口>/api`。本地页面默认请求 3888（见 `src/api/request.ts`），`PUBLIC_API_BASE_URL` 在构建时内嵌，改地址后必须重新构建，不能只重启 preview。验收后恢复标准生产构建。
4. **浏览器只验矩阵中的目标**：优先使用内置 `mcp__desktop_browser__run`，只开一个自建后台标签页，依次 `navigate` → `text.snapshot` 核对断言，不显示面板，不默认逐页截图或点击。只有视觉改动才需要 `visual.snapshot`，只有交互改动才操作控件。路由存在、标题正确或不再「加载中」都不等于数据正确；数据改动必须核对关键值及来源，休市时明确写「只验证最新收盘数据，未做盘中实测」。
5. **失败先分类，不盲目重复**：不水合或点击无效时，先看浏览器 console、脚本请求的 URL / 状态和 API 请求。脚本指向旧 CDN、API 指向未启动端口是环境配置问题，修正后重建，不改产品代码；接口错误看状态码和 trace；页面断言不符才继续查产品实现。相同失败重试仍没有新证据时，停止刷新和点击，改查日志或明确报告阻塞。遇到 `BROWSER_USER_TAKEOVER`，本轮停止浏览器操作并说明未完成的视觉验收。
6. **交付证据和边界一起写**：列出实际执行的检查、页面断言和未验证项，不用「一切正常」代替证据。本地通过不等于线上生效；push 后区分 commit、CI 和部署状态。结束后只关闭自己创建的标签页、停止自己启动的预览或服务。

## 重要文件路径

| 文件 | 作用 |
| :--- | :--- |
| `packages/briar-node/src/index.ts` | 后端入口；超管角色分配 + 定时任务调度器仅 `NODE_ENV=production`（或 `BRIAR_ENABLE_SCHEDULER=1`）启动，防止本地 dev 直连生产库时误跑清理/扫描任务 |
| `packages/briar-node/src/routes/api.ts` | API 路由汇总 |
| `packages/briar-node/src/middleware/config.ts` | 全局中间件配置 |
| `packages/briar-node/src/middleware/apiWriteGuard.ts` | 全局写操作安全网（默认拒绝未声明的写路由） |
| `packages/briar-node/src/config/routes.ts` | 公开路径白名单（控制 JWT 验证跳过） |
| `packages/briar-node/src/config/apiPermissions.ts` | 全局写路由权限映射表（**新增写路由必须在此注册**） |
| `packages/briar-node/src/lib/schedulerConfig.ts` | 定时任务注册表（唯一事实来源），新增任务在此注册后管理卡片自动展示 |
| `packages/briar-shared/src/constants.ts` | 共享常量（`API_BASE_PATH`、`NODE_PORT`） |
| `packages/briar-shared/src/permissions.ts` | 权限编码常量和分组 |
| `packages/briar-display/src/api/request.ts` | 前端 axios 实例，baseURL 自动计算；401 自动清死 token；`x-auth-token` 滑动续期就地替换 |
| `packages/briar-node/src/routes/version.ts` | `/api/version` 版本指纹接口（前后端一致性校验） |
| `packages/briar-node/src/routes/messages.ts` | 站内信 API（`/api/messages`）：列表/未读数/标记已读；前端面板 `components/profile/MessagesPanel.tsx`，未读数 hook `hooks/useUnreadMessages.ts`（60s 轮询） |
| `.github/workflows/deploy.yml` | CI：测试 + 构建前端 + 上传 CDN + SSH 部署后端 + 健康检查 |
| `default.conf` | Nginx 配置 |
| `ecosystem.config.cjs` | PM2 配置（cwd 为绝对路径） |

各功能模块的文件与设计细节见下方「功能文档」。

## 功能文档

| 文档 | 内容 |
| :--- | :--- |
| [docs/files.md](docs/files.md) | 文件管理（双 bucket、签名 URL、分片直传、隐私空间、封禁扫描） |
| [docs/media.md](docs/media.md) | 媒体解析 / 磁力查询（小红书/抖音/公众号/B站/X 解析细节、缓存与历史） |
| [docs/global-sectors.md](docs/global-sectors.md) | 全球板块（五市场板块行情源、实时/延迟、缓存与代理） |
| [docs/terminal.md](docs/terminal.md) | SSH 控制台（WS 桥接、设备授权、审计） |
| [docs/blog.md](docs/blog.md) | 个人博客（content collection、超管编辑预览） |
| [docs/deploy.md](docs/deploy.md) | 部署细节（触发范围、手动兜底、PM2 自启、GitHub Secrets） |
| [docs/pitfalls.md](docs/pitfalls.md) | 已知陷阱（只保留当前有效、可操作的非重复经验） |

## 路由架构

前端页面在 `packages/briar-display/src/pages/briar/`，后端 API 在 `packages/briar-node/src/routes/`。

Nginx 代理：

- `/` → `http://127.0.0.1:3888/`（302 跳转 `/briar/`；备案号展示在 `/briar/` 页脚）
- `/robots.txt` → nginx 直接返回（`Disallow: /api/`，拦 AI 爬虫嗅探）
- `/briar/` → `http://127.0.0.1:3888`（后端提供静态资源 + fallback）
- `/api/` → `http://127.0.0.1:3888/api/`

## RBAC 权限系统

RBAC 模型：`用户 → 角色 → 权限`（`user_roles` + `role_permissions`）。权限编码格式：`{模块}:{资源}:{操作}`（如 `admin:role:manage`）。

| 角色 | 标识 | 权限范围 |
| :--- | :--- | :--- |
| 普通用户 | `user` | 访问业务页面（`page:business`） |
| 管理员 | `moderator` | 预留（当前无额外权限） |
| 超级管理员 | `admin` | + 管理后台，自动放行所有检查 |

前端使用 `useRequirePermission` hook 或 `<PermissionGuard>` 组件。

### 安全架构：两层防线

**第一层：authMiddleware + routes.ts（谁能访问）**
- `routes.ts` 中的 `API_UNRESTRICTED_PATHS` 控制哪些路径跳过 JWT 验证（如登录/注册）
- `API_PUBLIC_PATHS` / `API_PUBLIC_PREFIXES` 控制 GET 请求的公开访问（如 `/api/version`）
- 登录 token 校验走 `authService.verifyLoginToken`：JWT 签名 + 用户存在 + `users.token_version` 与 token 的 `tv` 一致（改密码自增，旧 token 立即失效）；带 `purpose` 的专用 token（设备令牌/隐私解锁）不能当登录态
- 滑动续期：token 剩余有效期过半时响应头带 `x-auth-token` 新 token，前端 `request.ts` 拦截器就地替换 localStorage/cookie；本地 dev 跨端口靠 CORS `exposeHeaders` 暴露该头

**第二层：apiWriteGuard + apiPermissions.ts（能做什么）**
- 全局中间件，拦截所有 POST/PUT/PATCH/DELETE 请求
- `apiPermissions.ts` 是统一的写路由权限映射表
- 已声明 → 检查权限；标记 null → 公开放行；未声明 → **默认拒绝（403）+ 控制台警告**

**新增写路由时必须在 `apiPermissions.ts` 中注册**，否则会被拦截。这是故意设计的安全网。契约测试 `src/config/apiPermissions.contract.test.ts` 双向校验：路由↔映射表一一对应、免登录路径不得配权限，改了路由忘了同步表会让 CI 红。

## 部署

`git push` 到 master/main → GitHub Actions 一条流水线：后端测试 → 构建前端 + 上传 CDN → rsync 到服务器 `web/` → SSH 调 `deploy.sh`（build shared+node、migrate、PM2 重启）→ 健康检查 `/api/version`。

| 修改内容 | 执行 |
| :--- | :--- |
| `packages/briar-node/src/**/*.ts` | git push，CI 自动部署（含 migrate） |
| `packages/briar-display/src/**/*.{tsx,astro}` | git push，CI 自动同步 |
| `packages/briar-shared/src/**/*.ts` | git push，CI 自动（deploy.sh 默认 build shared+node） |
| `default.conf` | `./scripts/deploy-nginx.sh`（手动） |
| `.env` | `pm2 restart briar-node`（手动，.env 不在 git） |

**数据库**：`packages/briar-node/src/db/schema.sql` 是数据库结构唯一事实来源（完整、幂等的 CREATE TABLE IF NOT EXISTS + 种子数据，与线上一致）；`migrate.sql` 只放存量库的临时迁移/数据修补（幂等，线上生效后任何 agent 都可清空到只剩头注释）。建库（`make db-setup`）与每次部署（`scripts/deploy.sh`）都按 schema.sql → migrate.sql 顺序执行。结构变更 = 改 schema.sql 的 CREATE TABLE（全新库）+ 在 migrate.sql 写对应 ALTER（存量库）。

**版本校验**：`https://xiaobuzi.cn/api/version` 看 `backend.commit` 与 `frontend.commit` 是否一致。

触发范围、手动兜底、PM2 自启、Secrets 清单见 [docs/deploy.md](docs/deploy.md)。

## AI 排查日志

直接查数据库，不要翻 .log 文件：

```sql
SELECT * FROM request_logs WHERE trace_id = 'xxx';
SELECT * FROM request_logs WHERE status >= 400 ORDER BY created_at DESC LIMIT 20;
```

`request_logs` 含 `request_params`（脱敏）、`response_body`（脱敏 + 截断 2000 字符）、`error_message`、`error_stack`（未捕获异常）。代码里主动打的 `console.*` 会被 `lib/logger.ts` 的 `patchConsoleWithTrace` 自动加上 `[traceId]` 前缀（ALS 注入），PM2 日志可 `grep '<traceId>'` 关联一个请求的全部日志。敏感字段（token/password 等 key）入库前由 `redactSensitive` 替换为 `***`。

`request_logs` 保留 90 天，定时任务 `cleanup-request-logs` 每日清理（`BRIAR_CLEANUP_LOGS_CRON` 可覆盖）。

或 API：`GET /api/admin/logs?statusGroup=5xx&limit=20`（关键词搜索覆盖路径/参数/响应体/错误/trace）；管理页面 `/briar/admin/logs`。
