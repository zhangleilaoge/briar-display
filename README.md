# Briar Monorepo

基于 pnpm workspace 的 monorepo 项目，包含前端展示和 Node.js 后端服务。

## 快速开始

```bash
# 1. 克隆仓库并初始化子模块
git clone https://github.com/your-username/briar-display.git
cd briar-display

# 2. 初始化项目（拉取子模块 + 安装依赖）
make init

# 3. 初始化数据库
make db-setup

# 4. 启动开发服务器
make dev          # 前端
make dev-node     # 后端
```

## 可用命令

| 命令              | 说明                     |
| :---------------- | :----------------------- |
| `make init`       | 初始化项目（首次使用）   |
| `make install`    | 安装所有依赖             |
| `make db-setup`   | 初始化数据库             |
| `make dev`        | 启动前端开发服务器       |
| `make dev-node`   | 启动后端开发服务         |
| `make dev-shared` | 启动 shared 包监听模式   |
| `make build`      | 构建所有包（含依赖顺序） |
| `make upload-cdn` | 上传前端构建产物到 CDN   |
| `make build-cdn`  | 构建前端并上传到 CDN     |
| `make preview`    | 预览前端生产构建         |
| `make clean`      | 清理构建产物             |

## 部署

### GitHub Actions 自动构建

推送到 `master` 或 `main` 分支时自动触发构建并上传到 CDN。

需在 GitHub 仓库设置以下 Secrets：

```
BRIAR_TX_BUCKET_REGION
BRIAR_TX_SEC_ID
BRIAR_TX_SEC_KEY
BRIAR_TX_BUCKET_NAME

```

### 服务器部署

#### 首次部署

```bash
# 1. 在服务器上运行初始化脚本
bash <(curl -s https://raw.githubusercontent.com/your-username/briar-display/master/scripts/server-setup.sh)

# 或手动执行
git clone --recurse-submodules <repo-url> ~/briar-display
cd ~/briar-display
chmod +x scripts/*.sh
./scripts/server-setup.sh
```

#### 日常部署

```bash
# 在服务器项目目录下
./scripts/deploy.sh

# 跳过依赖安装（更快）
./scripts/deploy.sh --skip-install

# 跳过构建（仅重启）
./scripts/deploy.sh --skip-build
```

#### PM2 管理

```bash
# 查看状态
pm2 list

# 查看日志
pm2 logs briar-node

# 重启服务
pm2 reload briar-node

# 停止服务
pm2 stop briar-node

# 使用配置文件启动
pm2 start ecosystem.config.cjs
```

> 📖 详细部署文档请查看 [DEPLOYMENT.md](DEPLOYMENT.md)

## 环境变量

核心配置（可选）：

```bash
# 腾讯云 COS 配置
BRIAR_TX_BUCKET_REGION=ap-shanghai
BRIAR_TX_SEC_ID=...
BRIAR_TX_SEC_KEY=...
BRIAR_TX_BUCKET_NAME=...
BRIAR_TX_BUCKET_DOMAIN=https://your-bucket.cos.ap-shanghai.myqcloud.com

# 其他配置见 .env.example
```

**CDN 说明：**

前端构建时设置 `BRIAR_TX_BUCKET_DOMAIN`，所有静态资源会使用 CDN 地址。上传后，浏览器直接从 CDN 加载资源，减轻服务器压力。

## 项目结构

```
/
├── packages/
│   ├── briar-display/     # 前端项目 (Astro + React + Vue)
│   ├── briar-node/        # Node.js 后端服务
│   └── briar-shared/      # 共享工具库和类型定义
├── briar-assets/          # 子模块：资源文件
├── pnpm-workspace.yaml    # pnpm workspace 配置
├── Makefile               # 构建命令
└── package.json           # 根 package.json
```
