#!/bin/bash
# briar-mr-review.sh - MR 评论操作（fetch / comment / reply / diff / setup-worktree）
#
# Usage:
#   ./briar-mr-review.sh fetch         <domain> <project_path> <mr_iid>
#   ./briar-mr-review.sh comment       <domain> <project_path> <mr_iid> <body>
#   ./briar-mr-review.sh reply         <domain> <project_path> <mr_iid> <discussion_id> <body>
#   ./briar-mr-review.sh diff          <domain> <project_path> <mr_iid>
#   ./briar-mr-review.sh setup-worktree <domain> <project_path> <mr_iid>
#
# Token 加载优先级：环境变量 GITLAB_TOKEN → ~/.config/briar-skills/.env → ~/.git-credentials

set -e

# --- Token 自动加载 ---
# 如果环境变量已有且非占位符，直接用；否则依次尝试 .env 和 git credential store
load_gitlab_token() {
	if [ -n "$GITLAB_TOKEN" ] && [ "$GITLAB_TOKEN" != "***" ]; then
		return
	fi
	# 尝试从 .env 加载
	if [ -f "$HOME/.config/briar-skills/.env" ]; then
		# shellcheck disable=SC1091
		source "$HOME/.config/briar-skills/.env" 2>/dev/null || true
		if [ -n "$GITLAB_TOKEN" ] && [ "$GITLAB_TOKEN" != "***" ]; then
			return
		fi
	fi
	# 兜底：从 git credential store 提取 oauth2 token
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

ACTION="${1}"
DOMAIN="${2:-gitlab.qima-inc.com}"
PROJECT_PATH="${3}"

if [ -z "$PROJECT_PATH" ]; then
	echo "Usage:"
	echo "  $0 fetch         <domain> <project_path> <mr_iid>"
	echo "  $0 comment       <domain> <project_path> <mr_iid> <comment_body>"
	echo "  $0 reply         <domain> <project_path> <mr_iid> <discussion_id> <reply_body>"
	echo "  $0 diff          <domain> <project_path> <mr_iid>"
	echo "  $0 setup-worktree <domain> <project_path> <mr_iid>"
	exit 1
fi

ENCODED_PATH=$(echo "$PROJECT_PATH" | sed 's/\//%2F/g')

if [ "$ACTION" = "fetch" ]; then
	MR_IID="${4}"
	if [ -z "$MR_IID" ]; then
		echo "Error: mr_iid is required for 'fetch' action."
		exit 1
	fi
	BASE_URL="https://${DOMAIN}/api/v4/projects/${ENCODED_PATH}/merge_requests/${MR_IID}"

	echo "=== MR Notes ==="
	curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
		"${BASE_URL}/notes?per_page=100" | jq . 2>/dev/null || true

	echo ""
	echo "=== MR Discussions ==="
	curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
		"${BASE_URL}/discussions?per_page=100" | jq . 2>/dev/null || true

elif [ "$ACTION" = "comment" ]; then
	MR_IID="${4}"
	BODY="${5}"
	if [ -z "$MR_IID" ] || [ -z "$BODY" ]; then
		echo "Error: mr_iid and comment body are required for 'comment' action."
		exit 1
	fi
	BASE_URL="https://${DOMAIN}/api/v4/projects/${ENCODED_PATH}/merge_requests/${MR_IID}"
	JSON_PAYLOAD=$(jq -n --arg body "$BODY" '{body: $body}')
	curl -s -X POST \
		--header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
		--header "Content-Type: application/json" \
		--data "$JSON_PAYLOAD" \
		"${BASE_URL}/notes" | jq . 2>/dev/null || true
	echo ""
	echo "Comment posted."

elif [ "$ACTION" = "reply" ]; then
	MR_IID="${4}"
	DISCUSSION_ID="${5}"
	BODY="${6}"
	if [ -z "$MR_IID" ] || [ -z "$DISCUSSION_ID" ] || [ -z "$BODY" ]; then
		echo "Error: mr_iid, discussion_id and reply body are required for 'reply' action."
		exit 1
	fi
	BASE_URL="https://${DOMAIN}/api/v4/projects/${ENCODED_PATH}/merge_requests/${MR_IID}"
	JSON_PAYLOAD=$(jq -n --arg body "$BODY" '{body: $body}')
	curl -s -X POST \
		--header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
		--header "Content-Type: application/json" \
		--data "$JSON_PAYLOAD" \
		"${BASE_URL}/discussions/${DISCUSSION_ID}/notes" | jq . 2>/dev/null || true
	echo ""
	echo "Reply posted."

elif [ "$ACTION" = "diff" ]; then
	MR_IID="${4}"
	if [ -z "$MR_IID" ]; then
		echo "Error: mr_iid is required for 'diff' action."
		exit 1
	fi
	BASE_URL="https://${DOMAIN}/api/v4/projects/${ENCODED_PATH}/merge_requests/${MR_IID}"

	echo "=== MR Diff ===" >&2
	curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
		"${BASE_URL}/changes" | jq '{
			iid,
			title,
			source_branch,
			target_branch,
			changes_count,
			diff_refs,
			changes: [.changes[] | {
				old_path,
				new_path,
				new_file,
				deleted_file,
				diff
			}]
		}'

elif [ "$ACTION" = "setup-worktree" ]; then
	MR_IID="${4}"
	if [ -z "$MR_IID" ]; then
		echo "Error: mr_iid is required for 'setup-worktree' action."
		exit 1
	fi

	BASE_URL="https://${DOMAIN}/api/v4/projects/${ENCODED_PATH}/merge_requests/${MR_IID}"
	MR_INFO=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" "${BASE_URL}")
	SOURCE_BRANCH=$(echo "$MR_INFO" | jq -r '.source_branch')
	TARGET_BRANCH=$(echo "$MR_INFO" | jq -r '.target_branch')

	if [ -z "$SOURCE_BRANCH" ] || [ "$SOURCE_BRANCH" = "null" ]; then
		echo "Error: Failed to get source_branch from MR ${MR_IID}."
		exit 1
	fi

	REPO_NAME=$(echo "$PROJECT_PATH" | sed 's/.*\///')
	LOCAL_REPO="$HOME/projects/$REPO_NAME"

	if [ ! -d "$LOCAL_REPO/.git" ]; then
		echo "Error: Local repository not found at $LOCAL_REPO"
		echo "Please clone it first using briar-repo."
		exit 1
	fi

	FIX_SCRIPT="$(cd "$(dirname "$0")/../../briar-fix/scripts" && pwd)/briar-fix.sh"
	if [ ! -f "$FIX_SCRIPT" ]; then
		echo "Error: briar-fix.sh not found at $FIX_SCRIPT"
		exit 1
	fi

	WORKTREE_PATH=$("$FIX_SCRIPT" setup "$LOCAL_REPO" "$SOURCE_BRANCH" "review-${MR_IID}")

	echo ""
	echo "=== Review Worktree ==="
	echo "Path: $WORKTREE_PATH"
	echo "Branch: $SOURCE_BRANCH"
	echo "Target: $TARGET_BRANCH"
	echo ""
	echo "Commands:"
	echo "  View diff:       cd \"$WORKTREE_PATH\" && git diff origin/$TARGET_BRANCH..HEAD"
	echo "  View file:       cd \"$WORKTREE_PATH\" && cat <file>"
	echo "  Cleanup:         $FIX_SCRIPT cleanup \"$LOCAL_REPO\" \"$WORKTREE_PATH\""

else
	echo "Unknown action: $ACTION"
	echo "Supported actions: fetch, comment, reply, diff, setup-worktree"
	exit 1
fi
