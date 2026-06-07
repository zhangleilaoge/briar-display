#!/bin/bash
# briar-mr-create.sh - 创建 MR
# Usage: ./briar-mr-create.sh <domain> <project_path> <source_branch> <target_branch> <title> [description]

set -e

# --- 统一加载 .env 配置 ---
load_env() {
	# 1. 全局配置
	GLOBAL_ENV="$HOME/.config/briar-skills/.env"
	if [ -f "$GLOBAL_ENV" ]; then
		set -a; source "$GLOBAL_ENV"; set +a
	fi
	# 2. 向后兼容：项目内 .env
	PROJECT_ENV="$HOME/Documents/briar-display/.env"
	if [ -f "$PROJECT_ENV" ]; then
		set -a; source "$PROJECT_ENV"; set +a
	fi
}
load_env

DOMAIN="${1:-gitlab.qima-inc.com}"
PROJECT_PATH="${2}"
SOURCE_BRANCH="${3}"
TARGET_BRANCH="${4}"
TITLE="${5}"
DESCRIPTION="${6}"

if [ -z "$PROJECT_PATH" ] || [ -z "$SOURCE_BRANCH" ] || [ -z "$TARGET_BRANCH" ] || [ -z "$TITLE" ]; then
	echo "Usage: $0 <domain> <project_path> <source_branch> <target_branch> <title> [description]"
	exit 1
fi

if [ -z "$GITLAB_TOKEN" ]; then
	echo "Error: GITLAB_TOKEN is not set."
	exit 1
fi

ENCODED_PATH=$(echo "$PROJECT_PATH" | sed 's/\//%2F/g')
BASE_URL="https://${DOMAIN}/api/v4/projects/${ENCODED_PATH}/merge_requests"

JSON_PAYLOAD=$(jq -n \
	--arg source_branch "$SOURCE_BRANCH" \
	--arg target_branch "$TARGET_BRANCH" \
	--arg title "$TITLE" \
	--arg description "$DESCRIPTION" \
	'{
		source_branch: $source_branch,
		target_branch: $target_branch,
		title: $title,
		description: $description,
		remove_source_branch: false
	}')

RESULT=$(curl -s -X POST \
	--header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
	--header "Content-Type: application/json" \
	--data "$JSON_PAYLOAD" \
	"$BASE_URL")

echo "$RESULT" | jq . 2>/dev/null || echo "$RESULT"

MR_IID=$(echo "$RESULT" | jq -r '.iid // empty')
MR_WEB_URL=$(echo "$RESULT" | jq -r '.web_url // empty')
if [ -n "$MR_IID" ]; then
	echo ""
	echo "✅ MR created successfully!"
	echo "   IID: $MR_IID"
	echo "   URL: $MR_WEB_URL"
else
	echo ""
	echo "❌ Failed to create MR. See response above."
	exit 1
fi
