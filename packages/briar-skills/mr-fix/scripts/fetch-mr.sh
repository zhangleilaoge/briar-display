#!/bin/bash
# fetch-mr.sh - GitLab MR 评论操作
# Usage:
#   ./fetch-mr.sh fetch <domain> <project_path> <mr_iid>     # 获取所有评论
#   ./fetch-mr.sh comment <domain> <project_path> <mr_iid> <body>  # 发表评论
#
# Expects GITLAB_TOKEN to be set in environment.

set -e

ACTION="${1}"
DOMAIN="${2:-gitlab.qima-inc.com}"
PROJECT_PATH="${3}"
MR_IID="${4}"

if [ -z "$PROJECT_PATH" ] || [ -z "$MR_IID" ]; then
  echo "Usage:"
  echo "  $0 fetch   <domain> <project_path> <mr_iid>"
  echo "  $0 comment <domain> <project_path> <mr_iid> <comment_body>"
  echo ""
  echo "Example:"
  echo "  $0 fetch   gitlab.qima-inc.com wsc-node/wsc-pc-channel 932"
  echo "  $0 comment gitlab.qima-inc.com wsc-node/wsc-pc-channel 932 'LGTM!'"
  exit 1
fi

if [ -z "$GITLAB_TOKEN" ]; then
  echo "Error: GITLAB_TOKEN is not set."
  exit 1
fi

ENCODED_PATH=$(echo "$PROJECT_PATH" | sed 's/\//%2F/g')
BASE_URL="https://${DOMAIN}/api/v4/projects/${ENCODED_PATH}/merge_requests/${MR_IID}"

if [ "$ACTION" = "fetch" ]; then
  echo "=== MR Notes ==="
  curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
    "${BASE_URL}/notes?per_page=100" | python3 -m json.tool 2>/dev/null || true

  echo ""
  echo "=== MR Discussions ==="
  curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
    "${BASE_URL}/discussions?per_page=100" | python3 -m json.tool 2>/dev/null || true

elif [ "$ACTION" = "comment" ]; then
  BODY="${5}"
  if [ -z "$BODY" ]; then
    echo "Error: comment body is required for 'comment' action."
    exit 1
  fi
  curl -s -X POST \
    --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
    --header "Content-Type: application/json" \
    --data "{\"body\":\"${BODY}\"}" \
    "${BASE_URL}/notes" | python3 -m json.tool 2>/dev/null || true
  echo ""
  echo "Comment posted."
else
  echo "Unknown action: $ACTION"
  echo "Supported actions: fetch, comment"
  exit 1
fi
