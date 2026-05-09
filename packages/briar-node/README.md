# @briar/node

基于 Hono 的 Node.js 后端服务，提供 API 接口和静态资源托管。

## 开发

```bash
# 启动开发服务器
make dev-node
```

开发服务器将在 `http://localhost:3888` 启动。

## 部署

```bash
# 1. 初始化项目（首次）
make init

# 2. 初始化数据库
make db-setup

# 3. 构建整个项目（shared → display → node）
make build && bun run --filter @briar/node build

# 4. 启动生产服务器
bun run --filter @briar/node start
```

**日常更新部署：**

```bash
# 使用部署脚本（推荐）
./scripts/deploy.sh

# 快速部署（跳过依赖安装）
./scripts/deploy.sh --skip-install

# 仅重启（跳过构建）
./scripts/deploy.sh --skip-build
```

## 环境变量

```bash
# 服务器
PORT=3888

# 数据库
BRIAR_DATABASE_HOST=...
BRIAR_DATABASE_USER=...
BRIAR_DATABASE_PASSWORD=...

# 腾讯云 COS（用于上传 CDN）
BRIAR_TX_BUCKET_REGION=ap-shanghai
BRIAR_TX_SEC_ID=...
BRIAR_TX_SEC_KEY=...
BRIAR_TX_BUCKET_NAME=...
BRIAR_TX_BUCKET_DOMAIN=https://your-bucket.cos.ap-shanghai.myqcloud.com
```

**CDN 工作原理：**

前端构建时设置 `BRIAR_TX_BUCKET_DOMAIN` 环境变量，Astro 会将所有资源引用（JS、CSS、图片等）路径改为 CDN 地址。服务器只负责提供 HTML 页面，资源由浏览器直接从 CDN 加载。
