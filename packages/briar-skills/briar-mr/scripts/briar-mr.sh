#!/bin/bash
# briar-mr.sh - GitLab MR 全能工具
# Usage:
#   ./briar-mr.sh fetch   <domain> <project_path> <mr_iid>
#   ./briar-mr.sh comment <domain> <project_path> <mr_iid> <body>
#   ./briar-mr.sh reply   <domain> <project_path> <mr_iid> <discussion_id> <body>
#   ./briar-mr.sh create  <domain> <project_path> <source_branch> <target_branch> <title> <description>
#
# Expects GITLAB_TOKEN to be set in environment.

set -e

ACTION="${1}"
DOMAIN="${2:-gitlab.qima-inc.com}"
PROJECT_PATH="${3}"

if [ -z "$PROJECT_PATH" ]; then
	echo "Usage:"
	echo "  $0 fetch    <domain> <project_path> <mr_iid>"
	echo "  $0 comment  <domain> <project_path> <mr_iid> <comment_body>"
	echo "  $0 reply    <domain> <project_path> <mr_iid> <discussion_id> <reply_body>"
	echo "  $0 pipeline <domain> <project_path> <mr_iid>"
	echo "  $0 create   <domain> <project_path> <source_branch> <target_branch> <title> <description>"
	echo ""
	echo "Examples:"
	echo "  $0 fetch    gitlab.qima-inc.com wsc-node/wsc-pc-channel 932"
	echo "  $0 comment  gitlab.qima-inc.com wsc-node/wsc-pc-channel 932 'LGTM!'"
	echo "  $0 reply    gitlab.qima-inc.com wsc-node/wsc-pc-channel 932 abc123 '已修复 ✅'"
	echo "  $0 pipeline gitlab.qima-inc.com fe/scrm-mono 4849"
	echo "  $0 create   gitlab.qima-inc.com wsc-node/wsc-pc-channel feat/foo master 'feat: foo' 'Details...'"

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

elif [ "$ACTION" = "create" ]; then
	SOURCE_BRANCH="${4}"
	TARGET_BRANCH="${5}"
	TITLE="${6}"
	DESCRIPTION="${7}"
	if [ -z "$SOURCE_BRANCH" ] || [ -z "$TARGET_BRANCH" ] || [ -z "$TITLE" ]; then
		echo "Error: source_branch, target_branch and title are required for 'create' action."
		exit 1
	fi
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
elif [ "$ACTION" = "pipeline" ]; then
		MR_IID="${4}"
		if [ -z "$MR_IID" ]; then
			echo "Error: mr_iid is required for 'pipeline' action."
			exit 1
		fi
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
	else
		echo "Unknown action: $ACTION"
		echo "Supported actions: fetch, comment, reply, pipeline, create"
		exit 1
	fi
