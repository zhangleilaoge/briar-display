#!/bin/bash

# 手动触发 GitHub Actions 部署流水线
# 用法：./packages/briar-scripts/scripts/trigger-ci.sh [branch]
# 默认触发 master 分支

set -e

BRANCH="${1:-master}"
ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

echo "=========================================="
echo "手动触发 CI: $BRANCH"
echo "=========================================="

# 1. 读取 token
if [ ! -f "$ENV_FILE" ]; then
	echo "错误：找不到 $ENV_FILE"
	echo "请先运行 make init 拷贝环境变量文件"
	exit 1
fi

GITHUB_TOKEN=$(grep '^BRIAR_GITHUB_TOKEN=' "$ENV_FILE" | head -n 1 | cut -d'=' -f2-)
GITHUB_TOKEN=$(echo "$GITHUB_TOKEN" | sed 's/^[[:space:]]*["'\''']*//;s/["'\'''][[:space:]]*$//')

if [ -z "$GITHUB_TOKEN" ]; then
	echo "错误：$ENV_FILE 中未设置 BRIAR_GITHUB_TOKEN"
	exit 1
fi

# 2. 确保 gh 在 PATH 中
if ! command -v gh &> /dev/null; then
	if [ -d "/c/Program Files/GitHub CLI" ]; then
		export PATH="$PATH:/c/Program Files/GitHub CLI"
	elif [ -d "/mnt/c/Program Files/GitHub CLI" ]; then
		export PATH="$PATH:/mnt/c/Program Files/GitHub CLI"
	fi
fi

if ! command -v gh &> /dev/null; then
	echo "错误：gh CLI 未安装，请先安装：https://cli.github.com/"
	exit 1
fi

# 3. 登录 GitHub（非交互式）
echo "$GITHUB_TOKEN" | gh auth login --with-token

# 4. 触发 workflow
echo ""
echo "正在触发 workflow: deploy.yml ($BRANCH) ..."
gh workflow run deploy.yml --ref "$BRANCH"

# 5. 获取最新运行链接
sleep 2
RUN_URL=$(gh run list --workflow=deploy.yml --limit 1 --json url --jq '.[0].url' 2>/dev/null || true)

if [ -n "$RUN_URL" ]; then
	echo ""
	echo "✅ 已触发：$RUN_URL"
else
	echo ""
	echo "✅ 已触发，请到 Actions 页面查看："
	echo "https://github.com/$(gh repo view --json nameWithOwner --jq '.nameWithOwner')/actions/workflows/deploy.yml"
fi
