#!/bin/bash

# Nginx 配置部署脚本
# 使用方式: ./scripts/deploy-nginx.sh

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
NGINX_CONF_SRC="default.conf"
NGINX_CONF_DEST="/etc/nginx/conf.d/briar-display.conf"
SSL_CERT_SRC="briar-assets/ssl/xiaobuzi.cn_bundle.crt"
SSL_KEY_SRC="briar-assets/ssl/xiaobuzi.cn.key"
SSL_CERT_DEST="/etc/nginx/xiaobuzi.cn_bundle.crt"
SSL_KEY_DEST="/etc/nginx/xiaobuzi.cn.key"

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

# 主流程
main() {
  log_info "开始部署 Nginx 配置..."
  
  # 检查必要命令
  check_command nginx
  
  # 检查配置文件是否存在
  if [ ! -f "$NGINX_CONF_SRC" ]; then
    log_error "未找到 $NGINX_CONF_SRC，请确保在项目根目录下运行"
    exit 1
  fi

  # 检查证书文件是否存在
  if [ ! -f "$SSL_CERT_SRC" ]; then
    log_error "未找到 $SSL_CERT_SRC，请确保证书文件存在"
    exit 1
  fi

  if [ ! -f "$SSL_KEY_SRC" ]; then
    log_error "未找到 $SSL_KEY_SRC，请确保证书密钥文件存在"
    exit 1
  fi
  
  # 部署证书
  log_info "部署 SSL 证书..."
  sudo cp "$SSL_CERT_SRC" "$SSL_CERT_DEST"
  sudo cp "$SSL_KEY_SRC" "$SSL_KEY_DEST"
  sudo chmod 600 "$SSL_KEY_DEST"
  log_info "SSL 证书已部署"
  
  # 备份现有配置
  if [ -f "$NGINX_CONF_DEST" ]; then
    log_info "备份现有配置..."
    sudo cp "$NGINX_CONF_DEST" "${NGINX_CONF_DEST}.backup.$(date +%Y%m%d_%H%M%S)"
  fi
  
  # 更新 Nginx 配置
  log_info "复制新配置到 $NGINX_CONF_DEST..."
  sudo cp "$NGINX_CONF_SRC" "$NGINX_CONF_DEST"
  
  # 测试配置
  log_info "测试 Nginx 配置..."
  if sudo nginx -t; then
    # 重载配置
    log_info "重载 Nginx..."
    sudo systemctl reload nginx
    log_info "Nginx 配置已更新并重载成功！"
  else
    log_error "Nginx 配置测试失败，请检查配置文件"
    
    # 恢复备份
    if [ -f "${NGINX_CONF_DEST}.backup."* ]; then
      log_warn "正在恢复备份配置..."
      LATEST_BACKUP=$(ls -t "${NGINX_CONF_DEST}.backup."* 2>/dev/null | head -n 1)
      if [ -n "$LATEST_BACKUP" ]; then
        sudo cp "$LATEST_BACKUP" "$NGINX_CONF_DEST"
        sudo nginx -t && sudo systemctl reload nginx
        log_info "已恢复备份配置"
      fi
    fi
    exit 1
  fi
}

# 错误处理
trap 'log_error "部署 Nginx 配置时出错"; exit 1' ERR

# 执行主流程
main
