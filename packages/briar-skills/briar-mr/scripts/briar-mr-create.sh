#!/bin/bash
# briar-mr-create.sh - 创建 MR
# Usage: ./briar-mr-create.sh <domain> <project_path> <source_branch> <target_branch> <title> [description]
#
# Token 加载优先级：环境变量 GITLAB_TOKEN → ~/.config/briar-skills/.env → ~/.git-credentials

set -e

# --- Token 自动加载 ---
load_gitlab_token() {
	if [ -n "$GITLAB_TOKEN" ] && [ "$GITLAB_TOKEN" != "***" ]; then
		return
	fi
	if [ -f "$HOME/.config/briar-skills/.env" ]; then
		# shellcheck disable=SC1091
		source "$HOME/.config/briar-skills/.env" 2>/dev/null || true
		if [ -n "$GITLAB_TOKEN" ] && [ "$GITLAB_TOKEN" != "***" ]; then
			return
		fi
	fi
	local cred_token
	cred_token=$(grep "gitlab.qima-inc.com" "$HOME/.git-credentials" 2>/dev/null \
		| sed 's/.*oauth2:\([^@]*\)@.*/\1/' | head -1)
	if [ -n "$cred_token" ]; then
		export GITLAB_TOKEN="$cred_token"
		return
	fi
	echo "Error: GITLAB_TOKEN not found. Set it via env, ~/.config/briar-skills/.env, or ~/.git-credentials."
	exit 1
}

load_gitlab_token

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
