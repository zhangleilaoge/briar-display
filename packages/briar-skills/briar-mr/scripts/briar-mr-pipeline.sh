#!/bin/bash
# briar-mr-pipeline.sh - 获取 MR Pipeline 信息
# Usage: ./briar-mr-pipeline.sh <domain> <project_path> <mr_iid>

set -e

DOMAIN="${1:-gitlab.qima-inc.com}"
PROJECT_PATH="${2}"
MR_IID="${3}"

if [ -z "$PROJECT_PATH" ] || [ -z "$MR_IID" ]; then
	echo "Usage: $0 <domain> <project_path> <mr_iid>"
	exit 1
fi

if [ -z "$GITLAB_TOKEN" ]; then
	echo "Error: GITLAB_TOKEN is not set."
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
