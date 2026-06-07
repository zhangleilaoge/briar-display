# Briar Display — Agent Guide

## ⚠️ Agent 初始化提示

本项目包含多个项目级 skill（位于 `.agents/skills/` 目录下）：

- **`briar-mr`**：GitLab MR 全能工具（创建、评论、review、pipeline）
- **`briar-fix`**：基于 worktree 的代码安全修复
- **`briar-context`**：获取 Agent 上下文（Jira、GitLab MR、内网页面等链接内容抓取）
- ~~**`briar-readme-ai`**：自动认知协议初始化~~（已废弃，相关内容已整合至本文件）

---

## 项目概述

Briar Display 是一个基于 bun workspace 的 monorepo，包含：

- **前端** (`@briar/display`)：Astro + React + Vue + TailwindCSS，部署在 `/briar-display/` 子路径下
- **后端** (`@briar/node`)：Hono 框架 + MySQL2，端口 `3888`
- **共享库** (`@briar/shared`)：TypeScript 常量、类型和工具函数
- **脚本** (`@briar/scripts`)：构建辅助脚本

线上地址：`https://stardew.site/briar-display/`

## 技术栈细节

| 包 | 关键技术 | 备注 |
| :--- | :--- | :--- |
| `@briar/shared` | TypeScript, tsup | `API_BASE_PATH = '/api'`，`NODE_PORT = 3888` |
| `@briar/display` | Astro, React, Vue, TailwindCSS, axios | 前端 API 通过 axios 请求 `/api/*` |
| `@briar/node` | Hono, MySQL2, JWT, bcryptjs, bree | REST API，`app.route('/api', apiRoutes)` |
| `@briar/scripts` | TypeScript | CDN 上传等辅助脚本 |

## 开发工作流

### 包管理器

使用 **Bun**。根目录 `package.json` 定义 workspaces：

```json
"workspaces": ["packages/*"]
```

### 构建顺序

**必须按顺序构建**，因为 display 和 node 都依赖 shared：

```bash
bun run --filter @briar/shared build   # 先构建共享库
bun run --filter @briar/display build  # 再构建前端
bun run --filter @briar/node build     # 最后构建后端
```

根目录的 `make build` 只执行前两个。后端构建需要单独执行 `bun run --filter @briar/node build`。

### 开发命令

```bash
make dev         # 同时启动 shared(dev) + display(dev)
make dev-node    # 启动后端开发服务（tsx watch）
make dev-shared  # 单独启动 shared 监听模式
make build       # 构建 shared + display
```

### 代码规范

- **Formatter / Linter**：Biome（`biome.json` 已配置）
- **Git Hooks**：Lefthook（`lefthook.yml`）
  - `pre-commit`：Biome check + TypeScript typecheck
  - `commit-msg`：commit message lint
- **缩进**：Tab
- **引号**：单引号
- **尾逗号**：全部保留
- **分号**：按需（`asNeeded`）

运行代码检查：

```bash
make lint      # biome check .
make lint:fix  # biome check . --write
```

## 重要文件路径

| 文件 | 作用 |
| :--- | :--- |
| `packages/briar-node/src/index.ts` | 后端入口。注册中间件、API 路由、静态资源服务 |
| `packages/briar-node/src/routes/api.ts` | API 路由汇总 |
| `packages/briar-node/src/routes/admin.ts` | 权限管理 API（角色、权限、用户角色分配） |
| `packages/briar-node/src/middleware/config.ts` | 全局中间件配置（auth、cors、logger、errorHandler） |
| `packages/briar-node/src/middleware/permissionMiddleware.ts` | 权限检查中间件 `requirePermission()` |
| `packages/briar-node/src/config/routes.ts` | 公开路径白名单配置 |
| `packages/briar-node/src/services/permissionService.ts` | 权限服务（缓存、校验、角色管理） |
| `packages/briar-shared/src/permissions.ts` | 权限编码常量、分组定义 |
| `packages/briar-shared/src/constants.ts` | 共享常量：`API_BASE_PATH`、`NODE_PORT`、`DISPLAY_PORT` |
| `packages/briar-display/src/api/request.ts` | 前端 axios 实例，baseURL 根据环境自动计算 |
| `default.conf` | Nginx 配置模板 |
| `ecosystem.config.cjs` | PM2 配置（生产环境） |
| `Makefile` | 常用开发命令 |

## 路由与部署架构

### 前端路由

Astro 页面位于 `packages/briar-display/src/pages/briar-display/`，生产环境通过 Nginx 的 `/briar-display/` location 代理访问。

前端页面：
- `/briar-display/` — 门户入口页
- `/briar-display/login`
- `/briar-display/register`
- `/briar-display/forgot-password`
- `/briar-display/admin/permissions` — 角色与权限管理
- `/briar-display/admin/users` — 用户角色分配
- `/briar-display/tools/diff` — 在线文件 Diff
- `/briar-display/tools/compress` — 在线图片压缩
- `/briar-display/wiki/...` — Wiki SPA（详见 `packages/briar-display/src/components/wiki/AGENTS.md`）

### 后端路由

后端在 `packages/briar-node/src/index.ts` 中注册：

```ts
app.route('/api', apiRoutes)
```

实际可用的 API：
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/send-reset-code`
- `POST /api/auth/reset-password`

**Admin API**（权限管理，需认证 + 对应权限）：
- `GET /api/admin/roles` — 角色列表
- `GET /api/admin/roles/:id` — 角色详情（含权限）
- `POST /api/admin/roles` — 创建角色
- `PUT /api/admin/roles/:id` — 更新角色
- `DELETE /api/admin/roles/:id` — 删除角色
- `PUT /api/admin/roles/:id/permissions` — 设置角色权限
- `GET /api/admin/permissions` — 权限列表
- `GET /api/admin/users` — 用户列表（含角色，支持 keyword/page/pageSize 查询）
- `PUT /api/admin/users/:userId/roles` — 设置用户角色
- `GET /api/admin/me/permissions` — 当前用户权限（任何已登录用户可调用）

**Wiki API** — 详见 `packages/briar-display/src/components/wiki/AGENTS.md`

### Nginx 代理规则（关键）

`default.conf` 中的两条 location：

```nginx
location /briar-display/ {
    proxy_pass http://127.0.0.1:3888;
    # ...
}

location /api/ {
    proxy_pass http://127.0.0.1:3888/api/;
    # ...
}
```

**注意**：
- `/briar-display/` 代理到后端根路径 `http://127.0.0.1:3888`
- `/api/` 代理到后端 `/api/` 路径
- 后端使用 `app.use('/*', serveStatic(...))` 提供静态资源和 fallback 到 `index.html`

## 已知陷阱

### 1. Hono 的 `basePath()` 是 immutable 的

**错误写法**（曾被引入并导致 404）：

```ts
const app = new Hono()
app.basePath('/briar-display')  // ❌ 返回值被忽略，原 app 不受影响
app.route('/api', apiRoutes)    // 实际注册在 /api/*，不是 /briar-display/api/*
```

**正确做法**：如果需要 basePath，应该写成 `const app = new Hono().basePath('/briar-display')`。当前项目已通过 nginx 配置处理路径前缀，后端无需 basePath。

### 2. 构建顺序不可颠倒

`@briar/display` 和 `@briar/node` 都依赖 `@briar/shared` 的构建产物（`dist/`）。如果 shared 未先构建，display 和 node 会引用到旧代码或报错。

### 3. 前端 API baseURL 计算逻辑

`packages/briar-display/src/api/request.ts`：

```ts
const getApiBaseUrl = () => {
    const { protocol, hostname } = window.location
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1'
    const baseUrl = isLocal
        ? `${protocol}//${hostname}:${NODE_PORT}`   // 本地带端口
        : `${protocol}//${hostname}`                  // 生产不带端口
    return `${baseUrl}${API_BASE_PATH}`               // API_BASE_PATH = '/api'
}
```

生产环境前端请求的是 `https://stardew.site/api/*`，由 Nginx 代理到后端。不要试图在前端 baseURL 里加 `/briar-display`。

### 4. 环境变量加载

后端通过 `packages/briar-node/src/config/env.ts` 加载 `.env`，查找路径是 `../../../../.env`（即项目根目录）。确保 `.env` 在根目录，而不是在 `packages/briar-node/` 下。

### 5. 数据库初始化

`make db-setup` 执行 `packages/briar-node/src/db/setup.ts`，会读取 `packages/briar-node/src/db/schema.sql`。

数据库名固定为 `briar_display`。

## RBAC 权限系统

### 架构概览

采用 **RBAC（基于角色的访问控制）** 模型，分为两个维度：
- **页面访问权限**（`page:*`）— 控制用户能看到哪些页面
- **功能操作权限**（`api:*` / `wiki:*` / `admin:*`）— 控制用户能执行哪些操作

```
用户 → 角色 → 权限
user_roles  role_permissions  permissions
```

### 默认角色

| 角色 | 标识 | 等级 | 权限范围 |
| :--- | :--- | :--- | :--- |
| 普通用户 | `user` | 10 | 创建/编辑文章、讨论、评论、收藏、关注 |
| 管理员 | `moderator` | 50 | + 删除、分类/标签/模板管理、版本回退、审核变更 |
| 超级管理员 | `admin` | 100 | + 管理后台（角色/权限/用户分配），自动放行所有检查 |

访客（未登录）不需要角色，通过公开路由访问只读内容。

### 权限编码格式

```
{模块}:{资源}:{操作}
```

示例：
- `page:wiki` — 页面访问权限
- `wiki:page:create` — Wiki 页面创建
- `admin:role:manage` — 管理角色

### 数据库表

- `roles` — 角色定义
- `permissions` — 权限定义（type: page/api）
- `role_permissions` — 角色-权限关联
- `user_roles` — 用户-角色关联

运行 `make db-setup` 自动初始化默认数据。

### 前端权限使用

Wiki 模块已通过 `PermissionProvider` 包裹，详见 `packages/briar-display/src/components/wiki/AGENTS.md`。

## 修改建议

### 修改 API 路由

编辑 `packages/briar-node/src/routes/` 下的文件。如果需要新增路由，在 `api.ts` 中注册：

```ts
api.route('/new-module', newModuleRoutes)
```

如果新增公开 API（无需认证），同步修改 `packages/briar-node/src/config/routes.ts` 中的 `API_PUBLIC_PATHS`。

### 修改前端页面

Astro 页面在 `packages/briar-display/src/pages/briar-display/`。组件在 `packages/briar-display/src/components/`。

### 修改 Nginx 配置

编辑根目录的 `default.conf`，然后运行 `./scripts/deploy-nginx.sh` 同步到服务器。脚本会：
1. 拷贝 `default.conf` 到 `/etc/nginx/conf.d/briar-display.conf`
2. 拷贝 SSL 证书到 `/etc/nginx/`
3. `nginx -t` 测试配置
4. `systemctl reload nginx`

### 修改共享常量

编辑 `packages/briar-shared/src/constants.ts`，然后重新构建 shared：

```bash
bun run --filter @briar/shared build
```

依赖 shared 的包（display、node）也需要重新构建。

## 部署检查清单

### 自动部署（推荐）

前端构建和部署已接入 GitHub Actions：

1. `git push` 到 `master`/`main` 触发 GitHub Actions
2. Actions 构建前端 → 上传 CDN → `rsync` 到服务器的 `web/` 目录 → SSH 构建 node 后端 → PM2 重启
3. **服务器上无需手动构建前端**，`deploy.sh` 默认只构建 node 后端；前端资源放在 `web/` 目录，与本地构建的 `dist/` 独立，避免互相覆盖

如需服务器上完整构建（首次部署或特殊情况），使用 `./scripts/deploy.sh --full-build`。

### 手动部署

| 修改内容 | 必须执行 |
| :--- | :--- |
| `packages/briar-node/src/**/*.ts` | `./scripts/deploy.sh`（默认只构建 node + 重启） |
| `packages/briar-display/src/**/*.tsx` 等 | 提交代码，由 GitHub Actions 自动同步到 `web/` 目录（不要手动在服务器构建 display，会覆盖本地 dist，但不影响线上 web） |
| `default.conf` | `./scripts/deploy-nginx.sh` |
| `.env` | `pm2 restart briar-node`（让 PM2 重新加载 env_file） |
| `packages/briar-shared/src/**/*.ts` | `./scripts/deploy.sh --full-build`（需完整构建） |
