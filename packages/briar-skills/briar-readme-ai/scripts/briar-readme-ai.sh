#!/bin/bash
# briar-readme-ai.sh - AI 项目认知协议工具
# Usage:
#   ./briar-readme-ai.sh read
#   ./briar-readme-ai.sh init
#   ./briar-readme-ai.sh rewrite
#   ./briar-readme-ai.sh delete
#
# Expects README_AI_BASE_URL to be set, defaults to http://localhost:3888

set -e

ACTION="${1}"
PROJECT_PATH="$(pwd)"
PROJECT_NAME="$(basename "$PROJECT_PATH")"
BASE_URL="${README_AI_BASE_URL:-http://localhost:3888}"

usage() {
	echo "Usage:"
	echo "  $0 read"
	echo "  $0 init"
	echo "  $0 rewrite"
	echo "  $0 delete"
	echo ""
	echo "Environment:"
	echo "  README_AI_BASE_URL  Service base URL (default: http://localhost:3888)"
	exit 1
}

if [ -z "$ACTION" ]; then
	usage
fi

if [ "$ACTION" != "read" ] && [ "$ACTION" != "init" ] && [ "$ACTION" != "rewrite" ] && [ "$ACTION" != "delete" ]; then
	usage
fi

# --- read ---
if [ "$ACTION" = "read" ]; then
	LOCAL_EXISTS=false
	REMOTE_EXISTS=false
	LOCAL_CONTENT=""
	REMOTE_CONTENT=""

	# 1. 检查本地
	if [ -f "$PROJECT_PATH/readme.ai.md" ]; then
		LOCAL_EXISTS=true
		LOCAL_CONTENT=$(cat "$PROJECT_PATH/readme.ai.md")
		echo "✅ 本地存在 readme.ai.md"
	else
		echo "❌ 本地不存在 readme.ai.md"
	fi

	# 2. 查询服务端
	RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/readme-ai?projectPath=$PROJECT_PATH" || echo -e "\n000")
	HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
	BODY=$(echo "$RESPONSE" | sed '$d')

	if [ "$HTTP_CODE" = "200" ]; then
		REMOTE_EXISTS=true
		REMOTE_CONTENT=$(echo "$BODY" | jq -r '.data.content // empty')
		echo "✅ 服务端存在 readme.ai.md"
	else
		echo "❌ 服务端不存在 readme.ai.md (HTTP $HTTP_CODE)"
	fi

	# 3. 决策并同步
	if [ "$LOCAL_EXISTS" = "true" ] && [ "$REMOTE_EXISTS" = "true" ]; then
		echo ""
		echo "本地和服务端均存在，输出本地内容（Agent 应自行对比时间戳决策）："
		echo "$LOCAL_CONTENT"
	elif [ "$LOCAL_EXISTS" = "true" ] && [ "$REMOTE_EXISTS" = "false" ]; then
		echo ""
		echo "本地有，服务端无。正在同步到服务端..."
		JSON_PAYLOAD=$(jq -n \
			--arg projectPath "$PROJECT_PATH" \
			--arg projectName "$PROJECT_NAME" \
			--arg content "$LOCAL_CONTENT" \
			'{projectPath: $projectPath, projectName: $projectName, content: $content}')
		curl -s -X POST \
			-H "Content-Type: application/json" \
			-d "$JSON_PAYLOAD" \
			"$BASE_URL/api/readme-ai/init" | jq .
	elif [ "$LOCAL_EXISTS" = "false" ] && [ "$REMOTE_EXISTS" = "true" ]; then
		echo ""
		echo "本地无，服务端有。正在写入本地..."
		echo "$REMOTE_CONTENT" > "$PROJECT_PATH/readme.ai.md"
		echo "✅ 已写入 $PROJECT_PATH/readme.ai.md"
		echo "$REMOTE_CONTENT"
	else
		echo ""
		echo "本地和服务端都不存在 readme.ai.md"
		echo "请 Agent 扫描代码后执行：$0 init"
		exit 1
	fi

	exit 0
fi

# --- init ---
if [ "$ACTION" = "init" ]; then
	if [ ! -f "$PROJECT_PATH/readme.ai.md" ]; then
		echo "Error: $PROJECT_PATH/readme.ai.md does not exist."
		echo "Agent 应先扫描代码生成内容并写入本地，再执行 init。"
		exit 1
	fi

	CONTENT=$(cat "$PROJECT_PATH/readme.ai.md")
	CODE_HASH=$(find "$PROJECT_PATH" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.json" \) -not -path "*/node_modules/*" -not -path "*/.git/*" | sort | xargs cat | sha256sum | cut -d' ' -f1)

	JSON_PAYLOAD=$(jq -n \
		--arg projectPath "$PROJECT_PATH" \
		--arg projectName "$PROJECT_NAME" \
		--arg content "$CONTENT" \
		--arg codeHash "$CODE_HASH" \
		'{projectPath: $projectPath, projectName: $projectName, content: $content, codeHash: $codeHash}')

	echo "正在初始化服务端认知..."
	curl -s -X POST \
		-H "Content-Type: application/json" \
		-d "$JSON_PAYLOAD" \
		"$BASE_URL/api/readme-ai/init" | jq .
	exit 0
fi

# --- rewrite ---
if [ "$ACTION" = "rewrite" ]; then
	if [ ! -f "$PROJECT_PATH/readme.ai.md" ]; then
		echo "Error: $PROJECT_PATH/readme.ai.md does not exist."
		echo "如需初始化，请执行：$0 init"
		exit 1
	fi

	CONTENT=$(cat "$PROJECT_PATH/readme.ai.md")
	CODE_HASH=$(find "$PROJECT_PATH" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.json" \) -not -path "*/node_modules/*" -not -path "*/.git/*" | sort | xargs cat | sha256sum | cut -d' ' -f1)

	JSON_PAYLOAD=$(jq -n \
		--arg projectPath "$PROJECT_PATH" \
		--arg content "$CONTENT" \
		--arg codeHash "$CODE_HASH" \
		'{projectPath: $projectPath, content: $content, codeHash: $codeHash}')

	echo "正在重写服务端认知..."
	curl -s -X POST \
		-H "Content-Type: application/json" \
		-d "$JSON_PAYLOAD" \
		"$BASE_URL/api/readme-ai/rewrite" | jq .
	exit 0
fi

# --- delete ---
if [ "$ACTION" = "delete" ]; then
	echo "正在删除服务端认知..."
	curl -s -X DELETE \
		"$BASE_URL/api/readme-ai?projectPath=$PROJECT_PATH" | jq .

	if [ -f "$PROJECT_PATH/readme.ai.md" ]; then
		rm "$PROJECT_PATH/readme.ai.md"
		echo "✅ 已删除本地 $PROJECT_PATH/readme.ai.md"
	fi
	exit 0
fi
