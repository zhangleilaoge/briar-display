# @briar/display

基于 Astro 构建的多框架展示项目，集成了 React 和 Vue 组件。

## 技术栈

- **Astro** - 静态站点生成器
- **React** - UI 组件库
- **Vue** - UI 组件库
- **TypeScript** - 类型支持

## 开发

在项目根目录执行：

```bash
# 启动开发服务器
bun run --filter @briar/display dev

# 或使用快捷命令
bun run dev
# 或
make dev
```

开发服务器将在 `http://localhost:4321` 启动。

## 构建

```bash
# 构建生产版本
bun run --filter @briar/display build

# 或
bun run build
# 或
make build
```

## 预览

```bash
# 预览生产构建
bun run --filter @briar/display preview

# 或
bun run preview
# 或
make preview
```

## 远程服务器调试指南

生产环境通过 GitHub Actions 自动构建并同步到远程服务器。

### SSH 连接信息

连接信息（host、port、user、pass）存放在 `briar-assets/briar/.env` 中，Agent 读取该文件即可获取 SSH 凭证。README 中不再写明任何敏感信息。

### 常用调试命令

```bash
# 连接服务器（从 briar-assets/briar/.env 读取凭证）
# ssh -p $DEPLOY_PORT $DEPLOY_USER@$DEPLOY_HOST

# 项目目录
cd /home/ubuntu/Documents/briar-display

# 查看 PM2 进程状态
pm2 status
pm2 logs briar-node
pm2 logs briar-node --lines 100

# 重启后端
pm2 restart ecosystem.config.cjs

# 手动构建后端（前端 dist 由 Actions 同步，不要手动构建 display）
bun run --filter @briar/node build

# 查看服务器上的 dist 文件
ls -la packages/briar-display/dist/
find packages/briar-display/dist/_astro -type f

# 查看 Nginx 配置
cat /etc/nginx/conf.d/briar-display.conf
nginx -t
sudo systemctl reload nginx
```

### 部署脚本

```bash
# 服务器上执行：只构建后端并重启（前端 dist 已由 Actions 同步）
cd /home/ubuntu/Documents/briar-display
./scripts/deploy.sh

# 如需完整构建（首次部署或特殊情况）
./scripts/deploy.sh --full-build

# 同步 Nginx 配置
./scripts/deploy-nginx.sh
```

### GitHub Actions 部署流程

1. `git push` 到 `master`/`main` 触发 Actions
2. Actions 构建前端 → 上传 CDN
3. `rsync --delete` dist 到服务器
4. SSH 构建 node 后端 + PM2 重启

### 注意事项

- **不要在服务器上手动构建前端**（`bun run --filter @briar/display build`），会覆盖 Actions 同步的 dist，导致 HTML 和 CDN JS hash 不一致
- 前端问题修复后提交代码，由 Actions 自动部署
- 后端问题可本地修复后提交，或在服务器上直接修改后重启

## 项目结构

```
/
├── public/                # 静态资源
├── src/
│   ├── components/        # 组件
│   │   ├── astro/        # Astro 组件
│   │   ├── react/        # React 组件
│   │   └── vue/          # Vue 组件
│   ├── layouts/          # 布局组件
│   └── pages/            # 页面路由
├── astro.config.mjs      # Astro 配置
├── tsconfig.json         # TypeScript 配置
└── package.json
```
