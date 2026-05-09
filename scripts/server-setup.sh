#!/bin/bash

# 服务器初始化脚本
# 用于首次在服务器上配置 Briar 项目

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# 检查并安装 Bun
install_bun() {
  if command -v bun &> /dev/null; then
    log_info "bun 已安装: $(bun -v)"
  else
    log_info "安装 bun..."
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
  fi
}

# 检查并安装 PM2
install_pm2() {
  if command -v pm2 &> /dev/null; then
    log_info "PM2 已安装: $(pm2 -v)"
  else
    log_info "安装 PM2..."
    bun add -g pm2
    
    # 设置 PM2 开机自启
    log_info "配置 PM2 开机自启..."
    pm2 startup
    log_warn "请执行上面输出的命令以完成 PM2 开机自启配置"
  fi
}

# 克隆项目
clone_project() {
  read -p "请输入项目 Git 仓库地址: " REPO_URL
  read -p "请输入部署目录 (默认: ~/briar-display): " DEPLOY_DIR
  DEPLOY_DIR=${DEPLOY_DIR:-~/briar-display}
  
  if [ -d "$DEPLOY_DIR" ]; then
    log_warn "目录 $DEPLOY_DIR 已存在"
  else
    log_info "克隆项目到 $DEPLOY_DIR..."
    git clone --recurse-submodules "$REPO_URL" "$DEPLOY_DIR"
  fi
  
  cd "$DEPLOY_DIR"
}

# 配置环境变量
setup_env() {
  log_info "配置环境变量..."
  
  if [ -f ".env" ]; then
    log_warn ".env 文件已存在，跳过"
  else
    if [ -f "briar-assets/briar/.env" ]; then
      cp briar-assets/briar/.env .env
      log_info ".env 文件已从子模块拷贝"
    else
      log_warn "未找到子模块 .env"
      log_info "请手动创建 .env 文件"
    fi
    
    if [ -f ".env" ]; then
      log_warn "请编辑 .env 文件填写正确配置"
      log_info "运行: nano .env"
    fi
  fi
}

# 初始化项目
init_project() {
  log_info "初始化项目..."
  
  make init
  make db-setup
  
  log_info "构建项目（shared → display → node）..."
  bun run --filter @briar/shared build
  bun run --filter @briar/display build
  bun run --filter @briar/node build
}

# 启动服务
start_service() {
  log_info "启动服务..."
  
  if [ -f "ecosystem.config.cjs" ]; then
    pm2 start ecosystem.config.cjs
    log_info "使用 ecosystem.config.cjs 启动服务"
  else
    cd packages/briar-node
    NODE_ENV=production pm2 start dist/index.js --name briar-node
    cd ../..
    log_info "服务已启动"
  fi
  
  pm2 save
  pm2 list
}

# 主流程
main() {
  log_info "开始服务器初始化..."
  
  # 安装依赖
  install_bun
  install_pm2
  
  # 克隆项目
  clone_project
  
  # 配置环境
  setup_env
  
  read -p "是否现在初始化项目? (y/n): " INIT_NOW
  if [ "$INIT_NOW" = "y" ]; then
    init_project
    
    read -p "是否现在启动服务? (y/n): " START_NOW
    if [ "$START_NOW" = "y" ]; then
      start_service
    fi
  fi
  
  log_info "服务器初始化完成！"
  echo ""
  log_info "后续部署运行: ./scripts/deploy.sh"
  log_info "查看日志运行: pm2 logs briar-node"
  log_info "重启服务运行: pm2 reload briar-node"
}

main
