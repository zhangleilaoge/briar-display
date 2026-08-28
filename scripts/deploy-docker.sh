#!/bin/bash

# Briar Docker 部署脚本（CI 通过 SSH 在服务器执行）
# 前置：CI 已构建镜像并推送 CCR，且已把服务器代码 reset 到目标 commit
# 用法: BRIAR_IMAGE_TAG=<sha> DEPLOY_RUN_ID=<runId> bash scripts/deploy-docker.sh
#
# 老的 scripts/deploy.sh（PM2 方案）保留作回滚兜底，两者互斥不要同时跑

set -e

# 过渡期兼容：PM2 通过 nvm 安装，非交互式 SSH 下需要加载才有 pm2 命令
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" 2>/dev/null || true

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

BRIAR_IMAGE_TAG="${BRIAR_IMAGE_TAG:-latest}"
export BRIAR_IMAGE_TAG

# 行级部署进度文件：Admin 部署弹窗通过 /api/deployment/live 实时读取
# （该文件 bind-mount 进 app 容器，路径与 deploymentService 默认值一致）
PROGRESS_FILE="${DEPLOY_PROGRESS_FILE:-/tmp/briar-deploy-progress.log}"

progress() {
	echo "$(date '+%H:%M:%S') $1" >>"$PROGRESS_FILE" 2>/dev/null || true
}

log_info() {
	echo -e "${GREEN}[INFO]${NC} $1"
	progress "$1"
}

log_error() {
	echo -e "${RED}[ERROR]${NC} $1"
	progress "ERROR: $1"
}

main() {
	touch "$PROGRESS_FILE"
	: >"$PROGRESS_FILE"
	progress "RUN ${DEPLOY_RUN_ID:--}"

	log_info "开始 Docker 部署（镜像 tag: $BRIAR_IMAGE_TAG）..."

	log_info "拉取镜像..."
	if ! docker compose pull; then
		log_error "docker compose pull 失败，请检查服务器到 CCR 的网络与登录状态"
		exit 1
	fi

	# 数据库迁移：在一次性容器内跑（mysql 容器需在运行，--no-deps 跳过依赖检查）
	# tsx 跑 src/db/migrate.ts，凭证从挂载的 /app/.env 读取，
	# BRIAR_DATABASE_HOST 由 compose environment 覆盖为 mysql 服务名
	log_info "执行数据库迁移..."
	if ! docker compose run --rm --no-deps app \
		node packages/briar-node/node_modules/.bin/tsx packages/briar-node/src/db/migrate.ts; then
		log_error "数据库迁移失败，中止部署（旧版本容器仍在运行）"
		exit 1
	fi

	log_info "重启容器..."
	# 过渡期：PM2 残留的老进程占着 3888 端口，停掉让位给容器（全量切换后可删）
	if command -v pm2 >/dev/null 2>&1 && pm2 describe briar-node >/dev/null 2>&1; then
		log_info "停止 PM2 残留进程 briar-node..."
		pm2 stop briar-node >/dev/null 2>&1 || true
		pm2 save >/dev/null 2>&1 || true
	fi
	docker compose up -d

	log_info "清理旧镜像..."
	docker image prune -f >/dev/null

	log_info "部署完成！"
	log_info "运行 'docker compose logs -f app' 查看日志"
}

trap 'log_error "部署过程中出错，请检查输出"; exit 1' ERR

main
