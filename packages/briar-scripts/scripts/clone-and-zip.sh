#!/bin/bash
set -euo pipefail

if [ -n "${1:-}" ]; then
	SOURCE_DIR="$1"
else
	read -rp "请输入目标文件夹位置: " SOURCE_DIR
fi

if [ -z "$SOURCE_DIR" ]; then
	echo "Usage: $0 <source-directory>"
	exit 1
fi

PACKAGE_JSON="$SOURCE_DIR/package.json"
if [ ! -f "$PACKAGE_JSON" ]; then
	echo "Error: package.json not found in $SOURCE_DIR"
	exit 1
fi

REPO_URL=$(jq -r '
	.repository // empty |
	if type == "string" then . else .url end
' "$PACKAGE_JSON" 2>/dev/null || true)

if [ -z "$REPO_URL" ] || [ "$REPO_URL" = "null" ]; then
	echo "Error: repository field not found in $PACKAGE_JSON"
	exit 1
fi

# Remove possible git+ prefix and fragment
REPO_URL="${REPO_URL#git+}"
REPO_URL="${REPO_URL%%#*}"

REPO_NAME=$(basename "$REPO_URL" .git)
OUTPUT_FILE="$PWD/${REPO_NAME}.tar.gz"

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Cloning $REPO_URL ..."
git clone --depth 1 "$REPO_URL" "$TMP_DIR/clone"

echo "Packing to $OUTPUT_FILE ..."
tar -czf "$OUTPUT_FILE" -C "$TMP_DIR/clone" .

echo "Done: $OUTPUT_FILE"
