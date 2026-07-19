# Briar Display

基于 bun workspace 的 monorepo，包含前端展示站点（Astro）和 Node.js 后端服务（Hono）。

线上地址：`https://stardew.site/briar-display/`

## 技术栈

| 包 | 技术 | 说明 |
| :--- | :--- | :--- |
| `@briar/shared` | TypeScript / tsup | 共享常量、类型和工具函数 |
| `@briar/display` | Astro + React + Vue + TailwindCSS | 前端页面，部署在 `/briar-display/` 子路径 |
| `@briar/node` | Hono + MySQL2 + JWT + bcryptjs | REST API 服务，端口 `3888` |
| `@briar/scripts` | TypeScript | 构建和部署辅助脚本 |

## 本地开发

### 环境要求

- [Bun](https://bun.sh) >= 1.2.0
- Node.js >= 22.0.0
- MySQL 8.0

### 初始化项目

```bash
# 1. 克隆仓库并初始化子模块
git clone --recurse-submodules <repo-url>
cd briar-display

# 2. 初始化（拷贝子模块中的 .env + 安装依赖）
make init

# 3. 编辑环境变量
cp .env.example .env   # 如果 make init 没成功拷贝
nano .env

# 4. 初始化数据库
make db-setup
```

> `make init` 会尝试从 `briar-assets/briar/.env` 拷贝环境变量文件。如果子模块未初始化，会自动执行 `git submodule update --init --recursive`。

### 环境变量

核心配置（`.env`）：

```bash
# 数据库（必需）
BRIAR_DATABASE_HOST=localhost
BRIAR_DATABASE_USER=your_username
BRIAR_DATABASE_PASSWORD=your_password
BRIAR_DATABASE_PORT=3306

# JWT 密钥（随机字符串）
BRIAR_JWT_SECRET=your_jwt_secret_key_here

# 服务器端口（默认 3888）
PORT=3888

# 腾讯云 COS（仅 CDN 上传需要）
BRIAR_TX_BUCKET_REGION=ap-shanghai
BRIAR_TX_SEC_ID=your_secret_id
BRIAR_TX_SEC_KEY=your_secret_key
BRIAR_TX_BUCKET_NAME=your_bucket_name
BRIAR_TX_BUCKET_DOMAIN=https://your-bucket.cos.ap-shanghai.myqcloud.com
```

### 启动开发服务

```bash
# 前端开发服务器（http://localhost:4321）
make dev

# 后端开发服务（热重载，http://localhost:3888）
make dev-node

# shared 包监听模式（单独调试共享库）
make dev-shared
```

> `make dev` 会同时启动 `@briar/shared`（监听模式）和 `@briar/display`（Astro dev）。

### 常用命令

| 命令 | 说明 |
| :--- | :--- |
| `make init` | 初始化项目（首次使用） |
| `make install` | 安装所有依赖 |
| `make db-setup` | 初始化数据库表结构 |
| `make build` | 构建 shared + display |
| `make build-shared` | 仅构建 shared 包 |
| `make build-cdn` | 构建前端并上传到腾讯云 CDN |
| `make upload-cdn` | 上传已有构建产物到 CDN |
| `make preview` | 预览前端生产构建 |
| `make clean` | 清理构建产物和缓存 |

## 项目结构

```
/
├── packages/
│   ├── briar-display/       # 前端 (Astro + React + Vue)
│   │   ├── src/
│   │   │   ├── pages/       # Astro 页面路由
│   │   │   │   ├── briar-display/   # 实际部署页面 (/briar-display/*)
│   │   │   │   └── demo/            # Demo 页面
│   │   │   ├── components/  # React / Vue 组件
│   │   │   └── api/         # 前端 API 请求封装 (axios)
│   ├── briar-node/          # 后端服务 (Hono)
│   │   ├── src/
│   │   │   ├── index.ts     # 服务入口
│   │   │   ├── routes/      # API 路由 (auth, wiki)
│   │   │   ├── middleware/  # 全局中间件 (auth, cors, logger)
│   │   │   ├── controllers/ # 业务控制器
│   │   │   ├── db/          # 数据库初始化和连接
│   │   │   └── jobs/        # 定时任务 (bree)
│   │   └── scripts/
│   │       └── upload-cdn.ts
│   ├── briar-shared/        # 共享库
│   │   └── src/
│   │       ├── constants.ts # 常量、端口、路径
│   │       └── types/       # TypeScript 类型定义
│   └── briar-scripts/       # 构建辅助脚本
├── briar-assets/            # Git 子模块：证书、环境变量模板
├── default.conf             # Nginx 配置模板
├── ecosystem.config.cjs     # PM2 配置
├── Makefile                 # 常用命令
└── bun.lock                 # Bun 锁定文件
```

## 部署

### 服务器要求

- Ubuntu / Debian
- Nginx
- MySQL 8.0
- Bun + PM2

### 首次部署

```bash
# 方式一：交互式初始化脚本
./scripts/server-setup.sh

# 方式二：手动
make init
make db-setup
make build
pm2 start ecosystem.config.cjs
```

### 日常部署

**默认**：直接 `git push`，CI 自动完成前后端部署（见下方 CI 章节）。

**手动兜底**（服务器上执行）：

```bash
./scripts/deploy.sh                # 完整部署（拉代码、装依赖、构建、migrate、重启）
./scripts/deploy.sh --skip-install # 跳过依赖安装
./scripts/deploy.sh --skip-build   # 仅 migrate + 重启 PM2
DEPLOY_COMMIT=<sha> ./scripts/deploy.sh  # 精确部署某次 commit
```

### Nginx 配置

项目根目录的 `default.conf` 是 Nginx 配置模板：

```bash
# 部署 Nginx 配置（会同步证书并 reload nginx）
./scripts/deploy-nginx.sh
```

实际生产部署在 `/briar-display/` 子路径，Nginx 配置要点：

- `location /briar-display/` 代理到前端静态资源和页面
- `location /api/` 代理到后端 API（`/api/*`）
- 后端端口 `3888`

### PM2 进程管理

```bash
pm2 list                    # 查看状态
pm2 logs briar-node         # 查看日志
pm2 reload briar-node       # 重启服务
pm2 stop briar-node         # 停止服务
```

### CI 自动部署

`.github/workflows/deploy.yml`：推送到 `master` / `main` 时一条流水线完成前端构建 + CDN 上传 + 后端 SSH 部署 + 健康检查：

1. 构建前端并上传腾讯云 CDN
2. 写入 `version.json` 版本指纹
3. rsync 前端产物到服务器 `web/`
4. SSH 调用 `deploy.sh`：更新代码、build shared+node、执行 migrate、PM2 重启
5. 健康检查 `GET /api/version`（重试 5 次）
6. 记录部署历史到 `briar-assets/deploy-history.jsonl`

需要的 GitHub Secrets：

- `DOCKER_GITHUB_TOKEN`（拉取子模块）
- `DEPLOY_KEY` / `DEPLOY_HOST` / `DEPLOY_USER`（SSH 部署）
- `DEPLOY_REMOTE_DIR`（可选，默认 `~/github/briar-display/packages/briar-display/web`）
- `DEPLOY_PROJECT_DIR`（可选，默认 `~/github/briar-display`）
- `BRIAR_TX_BUCKET_REGION` / `BRIAR_TX_SEC_ID` / `BRIAR_TX_SEC_KEY` / `BRIAR_TX_BUCKET_NAME`（CDN）

> 部署后访问 `https://stardew.site/api/version` 可校验前后端 commit 是否一致。
