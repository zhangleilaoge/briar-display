#!/bin/bash

# Briar 项目部署脚本
# 使用方式: ./scripts/deploy.sh [--skip-install] [--skip-build] [--full-build]
#
# 注意：前端资源由 GitHub Actions 构建并通过 rsync 同步到服务器的 web/ 目录，
# 与本地构建输出的 dist/ 独立，避免互相覆盖。
# 默认不再在服务器上构建前端。如需完整构建（首次部署或特殊情况），使用 --full-build。

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
PROJECT_NAME="briar-display"
PM2_APP_NAME="briar-node"
BACKUP_DIR="$HOME/backups/$PROJECT_NAME"
MAX_BACKUPS=5

# 参数解析
SKIP_INSTALL=false
SKIP_BUILD=false
FULL_BUILD=false

# CI 通过环境变量传入：精确 commit、项目根路径
DEPLOY_COMMIT="${DEPLOY_COMMIT:-}"

# 确保 nginx 服务已启动（CI 触发时可能无 sudo 权限，失败不致命）
if ! systemctl is-active --quiet nginx 2>/dev/null; then
    echo "[INFO] Starting nginx..."
    sudo systemctl start nginx 2>/dev/null || echo "[WARN] 无法启动 nginx（可能需要手动处理）"
else
    echo "[INFO] nginx already running, reloading configuration..."
    sudo systemctl reload nginx 2>/dev/null || echo "[WARN] nginx reload 失败（忽略，配置未变更）"
fi

for arg in "$@"; do
  case $arg in
    --skip-install)
      SKIP_INSTALL=true
      shift
      ;;
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --full-build)
      FULL_BUILD=true
      shift
      ;;
  esac
done

# 工具函数
log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# 检查命令是否存在
check_command() {
  if ! command -v $1 &> /dev/null; then
    log_error "$1 未安装，请先安装"
    exit 1
  fi
}

# 创建备份
create_backup() {
  log_info "创建备份..."
  
  mkdir -p "$BACKUP_DIR"
  
  if [ -d "packages/briar-node/dist" ]; then
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.tar.gz"
    
    tar -czf "$BACKUP_FILE" packages/briar-node/dist
    log_info "备份已创建: $BACKUP_FILE"
    
    # 清理旧备份
    BACKUP_COUNT=$(ls -1 "$BACKUP_DIR" | wc -l)
    if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
      log_info "清理旧备份..."
      cd "$BACKUP_DIR"
      ls -t | tail -n +$((MAX_BACKUPS + 1)) | xargs rm -f
      cd - > /dev/null
    fi
  fi
}

# 恢复备份
restore_backup() {
  log_warn "正在恢复最新备份..."
  
  LATEST_BACKUP=$(ls -t "$BACKUP_DIR" | head -n 1)
  
  if [ -n "$LATEST_BACKUP" ]; then
    tar -xzf "$BACKUP_DIR/$LATEST_BACKUP"
    log_info "备份已恢复: $LATEST_BACKUP"
  else
    log_error "未找到备份文件"
  fi
}

# 同步代码：支持 DEPLOY_COMMIT 精确部署，否则 git pull（重试 3 次应对网络抖动）
sync_code() {
  if [ -n "$DEPLOY_COMMIT" ]; then
    log_info "拉取指定 commit: $DEPLOY_COMMIT"
    if ! git fetch origin; then
      log_error "git fetch 失败，请检查服务器到 GitHub 的网络"
      exit 1
    fi
    if ! git checkout "$DEPLOY_COMMIT"; then
      log_error "git checkout $DEPLOY_COMMIT 失败"
      exit 1
    fi
    return
  fi

  log_info "拉取最新代码..."
  local pulled=false
  for i in 1 2 3; do
    if git pull origin master 2>/dev/null || git pull origin main 2>/dev/null; then
      pulled=true
      break
    fi
    log_warn "git pull 第 $i 次失败，重试..."
    sleep 3
  done
  if [ "$pulled" = false ]; then
    log_error "git pull 多次失败，请检查服务器到 GitHub 的网络（或通过 DEPLOY_COMMIT 部署）"
    exit 1
  fi
}

# 数据库迁移：从 .env 读凭证，不硬编码
run_migrate() {
  log_info "执行数据库迁移..."
  if [ ! -f "packages/briar-node/src/db/migrate.sql" ]; then
    log_warn "migrate.sql 不存在，跳过迁移"
    return
  fi

  if [ ! -f ".env" ]; then
    log_error ".env 不存在，无法获取数据库凭证"
    exit 1
  fi

  # 子 shell 加载 .env 执行 migrate，避免污染当前 shell 环境
  (
    set -a
    . ./.env
    set +a

    if [ -z "$BRIAR_DATABASE_USER" ] || [ -z "$BRIAR_DATABASE_PASSWORD" ]; then
      echo "${RED}[ERROR]${NC} .env 缺少 BRIAR_DATABASE_USER / BRIAR_DATABASE_PASSWORD" >&2
      exit 1
    fi

    mysql -h"${BRIAR_DATABASE_HOST:-127.0.0.1}" -P"${BRIAR_DATABASE_PORT:-3306}" \
      -u"$BRIAR_DATABASE_USER" --password="$BRIAR_DATABASE_PASSWORD" \
      briar_display < packages/briar-node/src/db/migrate.sql
  ) || {
    log_error "数据库迁移失败"
    exit 1
  }
  log_info "数据库迁移完成"
}

# 主流程
main() {
  log_info "开始部署 $PROJECT_NAME..."
  
  # 检查必要命令
  check_command git
  check_command bun
  check_command pm2
  
  # 检查 .env 文件
  if [ ! -f ".env" ]; then
    log_error ".env 文件不存在，请先配置环境变量"
    exit 1
  fi
  
  # 同步代码（支持 DEPLOY_COMMIT 精确部署 + 重试）
  sync_code
  
  # 更新子模块
  log_info "更新子模块..."
  git submodule update --init --recursive
  
  # 安装依赖
  if [ "$SKIP_INSTALL" = false ]; then
    log_info "安装依赖..."
    bun install
  else
    log_warn "跳过依赖安装"
  fi
  
  # 创建备份
  create_backup
  
  # 构建后端（前端 dist 由 GitHub Actions 同步，默认不在服务器构建）
  if [ "$SKIP_BUILD" = false ]; then
    if [ "$FULL_BUILD" = true ]; then
      log_info "完整构建（shared → display → node）..."
      if ! (bun run --filter @briar/shared build && \
        bun run --filter @briar/display build && \
        bun run --filter @briar/node build); then
        log_error "构建失败，正在恢复备份..."
        restore_backup
        exit 1
      fi
    else
      log_info "构建后端（node）..."
      log_warn "前端资源由 GitHub Actions 同步到 web/ 目录，如需服务器构建请使用 --full-build"
      if ! bun run --filter @briar/node build; then
        log_error "构建失败，正在恢复备份..."
        restore_backup
        exit 1
      fi
    fi
  else
    log_warn "跳过构建"
  fi
  
  # 写入版本指纹（构建产物 dist/version.json，供 /api/version 读取）
  if [ "$SKIP_BUILD" = false ]; then
    log_info "写入版本指纹..."
    bun run packages/briar-scripts/scripts/write-version.ts packages/briar-node/dist || log_warn "version 写入失败（不阻塞部署）"
  fi
  
  # 数据库迁移（从 .env 读凭证）
  run_migrate
  
  # 重启 PM2 应用
  log_info "重启应用..."
  
  if [ -f "ecosystem.config.cjs" ]; then
    # 先停止再启动，避免 reload 卡住
    pm2 stop ecosystem.config.cjs 2>/dev/null || true
    pm2 start ecosystem.config.cjs
    log_info "使用 ecosystem.config.cjs 启动应用"
  else
    if pm2 list | grep -q "$PM2_APP_NAME"; then
      pm2 stop "$PM2_APP_NAME"
      pm2 start "$PM2_APP_NAME" --update-env
      log_info "应用已重启"
    else
      log_warn "PM2 应用不存在，正在启动..."
      cd packages/briar-node
      NODE_ENV=production pm2 start dist/index.js --name "$PM2_APP_NAME"
      cd ../..
      log_info "应用已启动"
    fi
  fi
  
  # 保存 PM2 配置
  pm2 save
  
  log_info "部署完成！"
  log_info "运行 'pm2 logs $PM2_APP_NAME' 查看日志"
  log_info "运行 'pm2 monit' 查看监控"
}

# 错误处理
trap 'log_error "部署过程中出错，请检查日志"; exit 1' ERR

# 执行主流程
main
