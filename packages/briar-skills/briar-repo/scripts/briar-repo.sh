#!/bin/bash
# briar-repo.sh - 仓库拉取工具
# Usage:
#   ./briar-repo.sh pull <repo-name> [base_dir] [domain]
#
# Expects GITLAB_TOKEN to be set in environment.

set -e

ACTION="${1}"
REPO_NAME="${2}"
BASE_DIR="${3:-/Users/zhanglei/Documents/projects}"
DOMAIN="${4:-gitlab.qima-inc.com}"

if [ "$ACTION" != "pull" ]; then
	echo "Usage:"
	echo "  $0 pull <repo-name> [base_dir] [domain]"
	echo ""
	echo "Examples:"
	echo "  $0 pull wsc-pc-channel"
	echo "  $0 pull wsc-pc-trade /Users/zhanglei/work"
	exit 1
fi

if [ -z "$REPO_NAME" ]; then
	echo "Error: repo-name is required."
	exit 1
fi

if [ -z "$GITLAB_TOKEN" ]; then
	echo "Error: GITLAB_TOKEN is not set."
	exit 1
fi

LOCAL_PATH="${BASE_DIR}/${REPO_NAME}"

# 1. 检查本地是否已存在
if [ -d "$LOCAL_PATH/.git" ]; then
	echo "本地已有该仓库：$LOCAL_PATH"
	REMOTE_URL=$(cd "$LOCAL_PATH" && git remote get-url origin 2>/dev/null || echo "unknown")
	echo "远程地址：$REMOTE_URL"
	echo "如需更新请执行：cd $LOCAL_PATH && git pull"
	exit 0
fi

# 2. 搜索 GitLab 项目
ENCODED_NAME=$(echo "$REPO_NAME" | sed 's/ /%20/g')
SEARCH_RESULT=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
	"https://${DOMAIN}/api/v4/projects?search=${ENCODED_NAME}&per_page=20")

MATCHES=$(echo "$SEARCH_RESULT" | jq --arg name "$REPO_NAME" '[.[] | select(.name == $name)]')

COUNT=$(echo "$MATCHES" | jq 'length')

if [ "$COUNT" = "0" ] || [ -z "$COUNT" ]; then
	echo "❌ 未在 GitLab 找到名为 \"$REPO_NAME\" 的仓库"
	exit 1
elif [ "$COUNT" = "1" ]; then
	SELECTED=$(echo "$MATCHES" | jq '.[0]')
else
	# 多个匹配，优先选 wsc-node/ 前缀的
	PREFERRED=$(echo "$MATCHES" | jq '[.[] | select(.path_with_namespace | startswith("wsc-node/"))] | .[0] // empty')
	if [ -n "$PREFERRED" ] && [ "$PREFERRED" != "null" ]; then
		SELECTED="$PREFERRED"
		echo "发现多个同名仓库，自动选择正式仓库：$(echo "$SELECTED" | jq -r '.path_with_namespace')"
	else
		echo "发现多个同名仓库，请指定完整路径："
		echo "$MATCHES" | jq -r '.[] | "  - \(.path_with_namespace) (\(.web_url))"'
		exit 1
	fi
fi

PROJECT_PATH=$(echo "$SELECTED" | jq -r '.path_with_namespace')
SSH_URL=$(echo "$SELECTED" | jq -r '.ssh_url_to_repo')
WEB_URL=$(echo "$SELECTED" | jq -r '.web_url')

echo ""
echo "📦 准备克隆 $PROJECT_PATH"
echo "   URL: $SSH_URL"
echo "   目标: $LOCAL_PATH"
echo ""

# 3. 执行克隆
git clone "$SSH_URL" "$LOCAL_PATH"

echo ""
echo "✅ 克隆完成：$LOCAL_PATH"
echo "   Web: $WEB_URL"
