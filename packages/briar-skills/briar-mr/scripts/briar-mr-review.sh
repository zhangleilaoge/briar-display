#!/bin/bash
# briar-mr-review.sh - MR 评论操作（fetch / comment / reply / diff）
# Usage:
#   ./briar-mr-review.sh fetch    <domain> <project_path> <mr_iid>
#   ./briar-mr-review.sh comment  <domain> <project_path> <mr_iid> <body>
#   ./briar-mr-review.sh reply    <domain> <project_path> <mr_iid> <discussion_id> <body>
#   ./briar-mr-review.sh diff     <domain> <project_path> <mr_iid>

set -e

ACTION="${1}"
DOMAIN="${2:-gitlab.qima-inc.com}"
PROJECT_PATH="${3}"

if [ -z "$PROJECT_PATH" ]; then
	echo "Usage:"
	echo "  $0 fetch    <domain> <project_path> <mr_iid>"
	echo "  $0 comment  <domain> <project_path> <mr_iid> <comment_body>"
	echo "  $0 reply    <domain> <project_path> <mr_iid> <discussion_id> <reply_body>"
	echo "  $0 diff     <domain> <project_path> <mr_iid>"
	exit 1
fi

if [ -z "$GITLAB_TOKEN" ]; then
	echo "Error: GITLAB_TOKEN is not set."
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

else
	echo "Unknown action: $ACTION"
	echo "Supported actions: fetch, comment, reply, diff"
	exit 1
fi
