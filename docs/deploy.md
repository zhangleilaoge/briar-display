# 部署

主流程和速查表见根目录 [AGENTS.md](../AGENTS.md#部署)，这里记细节。

## 触发范围

CI 仅对 `packages/briar-{node,display,shared,scripts}`、`scripts/deploy.sh` 及根构建文件（`package.json`/`bun.lock`/`Makefile`/`biome.json`）的改动触发；其他改动（如 briar-agent、briar-skills、docs）不触发，如需部署可在 Actions 页面手动 `workflow_dispatch`。

版本指纹的 `sourceCommit` 取上述部署路径最后一次变更的提交（与 `.github/workflows/deploy.yml` 的完整 `push.paths` 保持一致，含 workflow 自身），用于前后端一致性判断。因此只更新 `briar-assets` 指针等不部署的提交不会一直显示「版本同步中」；`commit` 仍记录实际构建时的 HEAD。修改部署路径时必须同步 `write-version.ts` 的 `DEPLOY_PATHS`，且 checkout 必须保留完整 Git 历史。

## 流水线

后端测试 → 构建前端 + 上传 CDN → rsync 到服务器 `web/` → SSH 调用 `deploy.sh`（清理工作区、更新代码、build shared+node、migrate、写 version、PM2 重启）→ 健康检查 `GET /api/version`（8 次重试，中途自动 `pm2 resurrect` 兜底）→ 记录到 `briar-assets/deploy-history.jsonl`。

## 手动兜底

服务器上 `./scripts/deploy.sh`（支持 `--skip-install`/`--skip-build`/`--full-build`，支持 `DEPLOY_COMMIT=<sha>` 精确部署）。同步代码前会 `git reset --hard` + `git clean -fd`（跳过 .gitignore 内容与 `packages/briar-node/jobs` 构建产物，不碰子模块），保证工作区干净。

## PM2 开机自启

已配置 `pm2 startup`（systemd unit `pm2-ubuntu`，enabled）+ `pm2 save`，服务器重启后自动恢复进程。

## 所需 GitHub Secrets

`DOCKER_GITHUB_TOKEN`、`DEPLOY_KEY`、`DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_REMOTE_DIR`（默认 `~/github/briar-display/packages/briar-display/web`）、`DEPLOY_PROJECT_DIR`（默认 `~/github/briar-display`）、`BRIAR_TX_*`（CDN）。
