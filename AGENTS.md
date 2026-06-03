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
| `packages/briar-node/src/routes/api.ts` | API 路由汇总（auth、wiki） |
| `packages/briar-node/src/middleware/config.ts` | 全局中间件配置（auth、cors、logger、errorHandler） |
| `packages/briar-node/src/config/routes.ts` | 公开路径白名单配置 |
| `packages/briar-display/src/api/request.ts` | 前端 axios 实例，baseURL 根据环境自动计算 |
| `packages/briar-shared/src/constants.ts` | 共享常量：`API_BASE_PATH`、`NODE_PORT`、`DISPLAY_PORT` |
| `default.conf` | Nginx 配置模板 |
| `ecosystem.config.cjs` | PM2 配置（生产环境） |
| `Makefile` | 常用开发命令 |

## 路由与部署架构

### 前端路由

Astro 页面位于 `packages/briar-display/src/pages/briar-display/`，生产环境通过 Nginx 的 `/briar-display/` location 代理访问。

前端页面：
- `/briar-display/login`
- `/briar-display/register`
- `/briar-display/business`
- `/briar-display/forgot-password`

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

**Wiki API**（分层架构：dal → service → controller → route）：
- Pages:
  - `GET /api/wiki/pages` — 列表（?namespace, ?status, ?limit, ?offset）
  - `GET /api/wiki/pages/search` — 全文搜索（?q, ?limit, ?offset）
  - `GET /api/wiki/pages/:namespace/:slug` — 获取页面（自动跟踪重定向）
  - `GET /api/wiki/pages/:slug/redirects` — 获取重定向列表
  - `POST /api/wiki/pages`（需认证）— 创建页面
  - `PUT /api/wiki/pages/:slug`（需认证）— 更新页面
  - `DELETE /api/wiki/pages/:slug`（需认证）— 软删除页面
- Revisions:
  - `GET /api/wiki/pages/:slug/revisions` — 版本列表
  - `GET /api/wiki/pages/:slug/revisions/:revId` — 获取版本
  - `GET /api/wiki/pages/:slug/diff` — 版本差异（?from, ?to）
  - `POST /api/wiki/pages/:slug/revisions/:revId/revert`（需认证）— 回退版本
- Categories:
  - `GET /api/wiki/categories` — 列表
  - `GET /api/wiki/categories/tree` — 分类树
  - `GET /api/wiki/categories/:slug` — 分类详情（含页面列表）
  - `POST /api/wiki/categories`（需认证）
  - `PUT /api/wiki/categories/:slug`（需认证）
  - `DELETE /api/wiki/categories/:slug`（需认证）
  - `POST /api/wiki/categories/:slug/pages`（需认证）— 添加页面到分类
  - `DELETE /api/wiki/categories/:slug/pages/:pageId`（需认证）— 移除分类关联
- Discussions:
  - `GET /api/wiki/pages/:slug/discussions` — 讨论列表
  - `GET /api/wiki/pages/:slug/discussions/:topicId` — 获取讨论主题
  - `GET /api/wiki/pages/:slug/discussions/:topicId/replies` — 获取回复
  - `POST /api/wiki/pages/:slug/discussions`（需认证）— 创建讨论主题
  - `POST /api/wiki/pages/:slug/discussions/:topicId/replies`（需认证）— 创建回复
  - `PUT /api/wiki/pages/:slug/discussions/:topicId/resolve`（需认证）— 标记已解决
- Templates:
  - `GET /api/wiki/templates` — 列表
  - `GET /api/wiki/templates/:slug` — 获取模板
  - `POST /api/wiki/templates`（需认证）
  - `PUT /api/wiki/templates/:slug`（需认证）
  - `DELETE /api/wiki/templates/:slug`（需认证）
- Watchlist:
  - `GET /api/wiki/watchlist`（需认证）— 用户关注列表
  - `POST /api/wiki/watchlist/:slug`（需认证）— 关注页面
  - `DELETE /api/wiki/watchlist/:slug`（需认证）— 取消关注
  - `GET /api/wiki/watchlist/:slug/status`（需认证）— 检查是否关注
- Special Pages:
  - `GET /api/wiki/special/recent-changes` — 最近更改
  - `GET /api/wiki/special/statistics` — 统计数据
  - `GET /api/wiki/special/all-pages` — 所有页面
  - `GET /api/wiki/special/orphaned-pages` — 孤立页面
  - `GET /api/wiki/special/wanted-pages` — 缺失页面
  - `GET /api/wiki/special/user-contributions/:userId` — 用户贡献

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

`make db-setup` 执行 `packages/briar-node/src/db/setup.ts`，会读取 `packages/briar-node/src/db/schema.sql`。schema 包含：
- `users` 表
- `verification_codes` 表
- `wiki_pages` 表（含 FULLTEXT 索引 ngram 分词）
- `wiki_revisions` 表
- `wiki_categories` 表（支持层级）
- `wiki_page_categories` 表（页面-分类关联）
- `wiki_discussions` 表
- `wiki_discussion_replies` 表
- `wiki_watchlist` 表
- `wiki_templates` 表

数据库名固定为 `briar_display`。

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

修改以下文件后，**必须**执行对应的部署步骤：

| 修改内容 | 必须执行 |
| :--- | :--- |
| `packages/briar-node/src/**/*.ts` | `bun run --filter @briar/node build` + `pm2 restart briar-node` |
| `packages/briar-display/src/**/*.tsx` 等 | `bun run --filter @briar/display build` + `pm2 restart briar-node` |
| `default.conf` | `./scripts/deploy-nginx.sh` |
| `.env` | `pm2 restart briar-node`（让 PM2 重新加载 env_file） |
| `packages/briar-shared/src/**/*.ts` | 先 build shared，再 build display + node，最后 restart |
