#!/bin/bash
# briar-mr-review.sh - MR 评论操作（fetch / comment / reply / diff / find / post-notes）
#
# Usage:
#   ./briar-mr-review.sh fetch         <domain> <project_path> <mr_iid>
#   ./briar-mr-review.sh comment       <domain> <project_path> <mr_iid> <body>
#   ./briar-mr-review.sh reply         <domain> <project_path> <mr_iid> <discussion_id> <body>
#   ./briar-mr-review.sh diff          <domain> <project_path> <mr_iid>
#   ./briar-mr-review.sh find          <domain> <project_path> <source_branch>
#   ./briar-mr-review.sh post-notes    <domain> <project_path> <mr_iid> <comments.json>
#
# 注意：review 所需 worktree 由 using-git-worktrees skill 负责创建/清理，本脚本不再提供 setup-worktree。
#
# Token 加载优先级：环境变量 GITLAB_TOKEN → ~/.config/briar-skills/.env → ~/.git-credentials

set -e

# --- Token 自动加载 ---
# 如果环境变量已有且非占位符，直接用；否则依次尝试 .env 和 git credential store
load_gitlab_token() {
	if [ -n "$GITLAB_TOKEN" ] && [ "$GITLAB_TOKEN" != "***" ]; then
		export GITLAB_TOKEN
		return
	fi
	# 尝试从 .env 加载
	if [ -f "$HOME/.config/briar-skills/.env" ]; then
		# shellcheck disable=SC1091
		source "$HOME/.config/briar-skills/.env" 2>/dev/null || true
		if [ -n "$GITLAB_TOKEN" ] && [ "$GITLAB_TOKEN" != "***" ]; then
			export GITLAB_TOKEN
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

# --- 根据域名推断本地父目录 ---
infer_base_dir() {
	local domain="${1:-$DOMAIN}"
	REPO_SCRIPT="$(cd "$(dirname "$0")/../../briar-repo/scripts" && pwd)/briar-repo.sh"
	if [ -f "$REPO_SCRIPT" ]; then
		local repo_dir
		repo_dir=$("$REPO_SCRIPT" base-dir "$domain" 2>/dev/null)
		if [ -n "$repo_dir" ]; then
			echo "$repo_dir"
			return
		fi
	fi
	# 兜底默认
	case "$domain" in
		gitlab.qima-inc.com | gitlab.com)
			echo "$HOME/Documents/gitlab"
			;;
		github.com)
			echo "$HOME/Documents/github"
			;;
		*)
			echo "$HOME/projects"
			;;
	esac
}

ACTION="${1}"
DOMAIN="${2:-gitlab.qima-inc.com}"
PROJECT_PATH="${3}"

if [ -z "$PROJECT_PATH" ]; then
	echo "Usage:"
	echo "  $0 fetch         <domain> <project_path> <mr_iid>"
	echo "  $0 comment       <domain> <project_path> <mr_iid> <comment_body>"
	echo "  $0 reply         <domain> <project_path> <mr_iid> <discussion_id> <reply_body>"
	echo "  $0 diff          <domain> <project_path> <mr_iid>"
	echo "  $0 find          <domain> <project_path> <source_branch>"
	echo "  $0 post-notes    <domain> <project_path> <mr_iid> <comments.json>"
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

elif [ "$ACTION" = "find" ]; then
	SOURCE_BRANCH="${4}"
	if [ -z "$SOURCE_BRANCH" ]; then
		echo "Error: source_branch is required for 'find' action."
		exit 1
	fi

	URL="https://${DOMAIN}/api/v4/projects/${ENCODED_PATH}/merge_requests?state=all&source_branch=${SOURCE_BRANCH}"
	MR_JSON=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" "$URL" | jq '.[0]')

	if [ -z "$MR_JSON" ] || [ "$MR_JSON" = "null" ]; then
		echo "Error: No MR found for ${PROJECT_PATH} branch ${SOURCE_BRANCH}."
		exit 1
	fi

	echo "$MR_JSON" | jq '{
		iid,
		title,
		source_branch,
		target_branch,
		web_url,
		state
	}'

elif [ "$ACTION" = "post-notes" ]; then
	MR_IID="${4}"
	COMMENTS_FILE="${5}"
	if [ -z "$MR_IID" ] || [ -z "$COMMENTS_FILE" ]; then
		echo "Error: mr_iid and comments.json are required for 'post-notes' action."
		exit 1
	fi
	if [ ! -f "$COMMENTS_FILE" ]; then
		echo "Error: Comments file not found: $COMMENTS_FILE"
		exit 1
	fi

	BASE_URL="https://${DOMAIN}/api/v4/projects/${ENCODED_PATH}/merge_requests/${MR_IID}"
	DIFF_REFS=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" "$BASE_URL" | jq '.diff_refs')
	BASE_SHA=$(echo "$DIFF_REFS" | jq -r '.base_sha')
	HEAD_SHA=$(echo "$DIFF_REFS" | jq -r '.head_sha')
	START_SHA=$(echo "$DIFF_REFS" | jq -r '.start_sha')

	if [ -z "$BASE_SHA" ] || [ "$BASE_SHA" = "null" ]; then
		echo "Error: Failed to get diff_refs for MR ${MR_IID}."
		exit 1
	fi

	python3 - "${BASE_URL}/discussions" "$BASE_SHA" "$HEAD_SHA" "$START_SHA" "$COMMENTS_FILE" <<'PYEOF'
import json, os, sys, urllib.request, urllib.error

api_url = sys.argv[1]
base_sha = sys.argv[2]
head_sha = sys.argv[3]
start_sha = sys.argv[4]
comments_file = sys.argv[5]
token = os.environ.get('GITLAB_TOKEN')

with open(comments_file, 'r', encoding='utf-8') as f:
    comments = json.load(f)

for c in comments:
    payload = json.dumps({
        'body': c['body'],
        'position': {
            'base_sha': base_sha,
            'head_sha': head_sha,
            'start_sha': start_sha,
            'position_type': 'text',
            'new_path': c['path'],
            'new_line': c['line'],
        }
    }).encode('utf-8')
    req = urllib.request.Request(
        api_url,
        data=payload,
        headers={'PRIVATE-TOKEN': token, 'Content-Type': 'application/json'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req) as resp:
            resp.read()
            print(f"OK: {c['path']}:{c['line']}")
    except urllib.error.HTTPError as e:
        print(f"FAIL: {c['path']}:{c['line']} HTTP {e.code}: {e.read().decode('utf-8', errors='replace')[:200]}")
PYEOF

else
	echo "Unknown action: $ACTION"
	echo "Supported actions: fetch, comment, reply, diff, find, post-notes"
	exit 1
fi
