# Briar Display — Agent Guide

## 项目概述

Briar Display 是一个基于 bun workspace 的 monorepo：

- **前端** (`@briar/display`)：Astro + React + Vue + TailwindCSS，部署在 `/briar-display/` 子路径
- **后端** (`@briar/node`)：Hono + MySQL2，端口 `3888`
- **共享库** (`@briar/shared`)：TypeScript 常量、类型和工具函数
- **脚本** (`@briar/scripts`)：构建辅助脚本

线上地址：`https://stardew.site/briar-display/`

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

**UI 组件**：优先使用 shadcn/ui 组件（`@/components/ui/`），不要用原生 HTML 元素（`<select>`、`<input>`、`<dialog>` 等）。Radix Select、Input、Button、Dialog 等已配好样式和 wiki 主题适配。下拉框、搜索框、选择器等交互组件必须使用 shadcn 组件（如 Select、Command+Popover 组合的 Combobox），确保支持键盘导航（↑↓ 切换、Enter 确认、Esc 关闭）。面包屑使用 `Breadcrumb` 组件，页面切换导航使用 `Tabs` 组件，禁止硬编码面包屑文本或自定义按钮组模拟 tab 样式。错误提示、成功反馈等消息禁止使用 `alert()`/`confirm()`，统一使用 `sonner` 的 `toast()`/`toast.error()`/`toast.success()`（已全局挂载 Toaster，直接 `import { toast } from 'sonner'` 即可）。

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
| `packages/briar-node/src/routes/version.ts` | `/api/version` 版本指纹接口（前后端一致性校验） |
| `packages/briar-node/src/routes/files.ts` | 文件管理 API（`/api/files`，原图床）：上传 precheck/cos-sign/confirm、文件夹 CRUD、文本预览代理 |
| `packages/briar-display/src/api/files.ts` | 前端文件 API + cos-js-sdk-v5 分片直传封装 |
| `packages/briar-scripts/scripts/write-version.ts` | 构建时写入 `version.json` 的脚本 |
| `.github/workflows/deploy.yml` | CI：构建前端 + 上传 CDN + SSH 部署后端 + 健康检查 |
| `default.conf` | Nginx 配置 |
| `ecosystem.config.cjs` | PM2 配置（cwd 为绝对路径） |

## 路由架构

前端页面在 `packages/briar-display/src/pages/briar-display/`，后端 API 在 `packages/briar-node/src/routes/`，Wiki 模块详见 `packages/briar-display/src/components/wiki/AGENTS.md`。

### Nginx 代理

- `/` → `http://127.0.0.1:3888/`（根路径落地页，备案合规，源码 `packages/briar-node/src/routes/root.ts`）
- `/briar-display/` → `http://127.0.0.1:3888`（后端提供静态资源 + fallback）
- `/api/` → `http://127.0.0.1:3888/api/`

### 文件管理（原图床）

- 页面 `/briar-display/files`（旧 `/briar-display/images/*` 重定向至此），API `/api/files`
- 上传走**前端分片直传 COS**：`POST /api/files/precheck`（配额/去重/发 cosKey）→ cos-js-sdk-v5 `sliceUploadFile` 直传（分片签名由 `POST /api/files/cos-sign` 下发，仅放行 `files/{userId}/` 前缀）→ `POST /api/files/confirm` 写库。文件不经过 nginx/服务器，`client_max_body_size 10m` 不影响上传
- 直传依赖 COS bucket CORS，一次性配置：`make cos-cors`
- 视频封面：上传完成后客户端用 video+canvas 截首帧，直传为 `{cosKey去扩展名}.cover.jpg` 并在 confirm 时传 `thumbnailKey`；网格有封面用 `<img>`，存量无封面视频 fallback 到 `<video preload="metadata">`；删除文件/文件夹时连带删封面
- 数据表：`files`（原 `images` 表改名）+ `folders`（嵌套文件夹），迁移见 `migrate.sql`

## 已知陷阱

### 1. Hono 的 `basePath()` 是 immutable 的

```ts
// ❌ 返回值被忽略
app.basePath('/briar-display')
// ✅ 链式调用
const app = new Hono().basePath('/briar-display')
```

当前项目已通过 nginx 处理路径前缀，后端无需 basePath。

### 2. 前端 API baseURL 不要加 `/briar-display`

生产环境请求 `https://stardew.site/api/*`（Nginx 代理），`request.ts` 自动计算 baseURL，无需手动拼。

### 3. 环境变量在项目根目录

后端加载 `.env` 的路径是 `../../../../.env`（项目根目录），不是 `packages/briar-node/` 下。

### 4. 数据库初始化

`make db-setup` 执行 `packages/briar-node/src/db/setup.ts`，数据库名 `briar_display`。

### 5. 权限检查必须区分三态

**错误**：loading 期间 `hasPermission` 返回 false，闪现"无权限"。

**正确**：使用 `useRequirePermission` hook：

```tsx
const { loading, authorized, denied } = useRequirePermission('admin:xxx')
if (loading) return <Spinner />
if (denied) return <NoPermission />
return <Content />
```

## RBAC 权限系统

RBAC 模型：`用户 → 角色 → 权限`（`user_roles` + `role_permissions`）。

| 角色 | 标识 | 权限范围 |
| :--- | :--- | :--- |
| 普通用户 | `user` | 创建/编辑文章、讨论、评论、收藏 |
| 管理员 | `moderator` | + 删除、分类/标签/模板管理 |
| 超级管理员 | `admin` | + 管理后台，自动放行所有检查 |

权限编码格式：`{模块}:{资源}:{操作}`（如 `wiki:page:create`、`admin:role:manage`）。

前端使用 `useRequirePermission` hook 或 `<PermissionGuard>` 组件。

### 安全架构：两层防线

**第一层：authMiddleware + routes.ts（谁能访问）**
- `routes.ts` 中的 `API_UNRESTRICTED_PATHS` 控制哪些路径跳过 JWT 验证（如登录/注册）
- `API_PUBLIC_PATHS` / `API_PUBLIC_PREFIXES` 控制 GET 请求的公开访问（如 wiki 浏览）

**第二层：apiWriteGuard + apiPermissions.ts（能做什么）**
- 全局中间件，拦截所有 POST/PUT/PATCH/DELETE 请求
- `apiPermissions.ts` 是统一的写路由权限映射表
- 已声明 → 检查权限；标记 null → 公开放行；未声明 → **默认拒绝（403）+ 控制台警告**

**新增写路由时必须在 `apiPermissions.ts` 中注册**，否则会被拦截。这是故意设计的安全网。

## 部署

**自动部署**：`git push` 到 master/main → GitHub Actions 一条流水线完成：
构建前端 + 上传 CDN → rsync 到服务器 `web/` → SSH 调用 `deploy.sh`（更新代码、build shared+node、migrate、写 version、PM2 重启）→ 健康检查 `GET /api/version` → 记录到 `briar-assets/deploy-history.jsonl`。

**触发范围**：CI 仅对 `packages/briar-{node,display,shared,scripts}`、`scripts/deploy.sh` 及根构建文件（`package.json`/`bun.lock`/`Makefile`/`biome.json`）的改动触发；其他改动（如 briar-agent、briar-skills、docs）不触发，如需部署可在 Actions 页面手动 `workflow_dispatch`。

| 修改内容 | 执行 |
| :--- | :--- |
| `packages/briar-node/src/**/*.ts` | git push，CI 自动部署（含 migrate） |
| `packages/briar-display/src/**/*.{tsx,astro}` | git push，CI 自动同步 |
| `packages/briar-shared/src/**/*.ts` | git push，CI 自动（deploy.sh 默认 build shared+node） |
| `default.conf` | `./scripts/deploy-nginx.sh`（手动） |
| `.env` | `pm2 restart briar-node`（手动，.env 不在 git） |

**手动兜底**：服务器上 `./scripts/deploy.sh`（支持 `--skip-install`/`--skip-build`/`--full-build`，支持 `DEPLOY_COMMIT=<sha>` 精确部署）。

**版本校验**：访问 `https://stardew.site/api/version` 查看 `backend.commit` 与 `frontend.commit` 是否一致。

**所需 GitHub Secrets**：`DOCKER_GITHUB_TOKEN`、`DEPLOY_KEY`、`DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_REMOTE_DIR`（默认 `~/github/briar-display/packages/briar-display/web`）、`DEPLOY_PROJECT_DIR`（默认 `~/github/briar-display`）、`BRIAR_TX_*`（CDN）。

## AI 排查日志

直接查数据库，不要翻 .log 文件：

```sql
SELECT * FROM request_logs WHERE trace_id = 'xxx';
SELECT * FROM request_logs WHERE status >= 400 ORDER BY created_at DESC LIMIT 20;
```

或 API：`GET /api/admin/logs?statusGroup=5xx&limit=20`

管理页面：`/briar-display/admin/logs`
