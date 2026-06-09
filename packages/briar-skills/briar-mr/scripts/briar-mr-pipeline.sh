#!/bin/bash
# briar-mr-pipeline.sh - 获取 MR Pipeline 信息
# Usage: ./briar-mr-pipeline.sh <domain> <project_path> <mr_iid>
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
MR_IID="${3}"

if [ -z "$PROJECT_PATH" ] || [ -z "$MR_IID" ]; then
	echo "Usage: $0 <domain> <project_path> <mr_iid>"
	exit 1
fi

ENCODED_PATH=$(echo "$PROJECT_PATH" | sed 's/\//%2F/g')
BASE_URL="https://${DOMAIN}/api/v4/projects/${ENCODED_PATH}/merge_requests/${MR_IID}"

MR_DATA=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" "$BASE_URL")
HEAD_PIPELINE=$(echo "$MR_DATA" | jq '.head_pipeline // empty')

if [ -z "$HEAD_PIPELINE" ] || [ "$HEAD_PIPELINE" = "null" ]; then
	echo "No pipeline found for this MR."
	exit 0
fi

PIPELINE_ID=$(echo "$HEAD_PIPELINE" | jq -r '.id')

echo "=== Pipeline Info ==="
echo "$HEAD_PIPELINE" | jq '{
	id,
	status,
	duration,
	started_at,
	finished_at,
	web_url,
	ref,
	sha
}'

echo ""
echo "=== Pipeline Jobs ==="
curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
	"https://${DOMAIN}/api/v4/projects/${ENCODED_PATH}/pipelines/${PIPELINE_ID}/jobs" \
	| jq '[.[] | {
		id,
		name,
		stage,
		status,
		duration,
		failure_reason,
		web_url
	}]'
