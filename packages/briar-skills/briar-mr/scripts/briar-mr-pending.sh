#!/bin/bash
# briar-mr-pending.sh - 列出当前用户最近 N 天 open MR 中未回复的实质性人工评论
#
# Usage: ./briar-mr-pending.sh [arg...]
#
# 参数智能识别（顺序无关）：
#   - domain:        包含点的字符串，如 gitlab.qima-inc.com
#   - days:          纯数字，如 7 / 30
#   - project_filter: 其他字符串，用于模糊匹配 project_path，如 scrm-mono
#
# Examples:
#   ./briar-mr-pending.sh                          # 默认 30 天，全部仓库
#   ./briar-mr-pending.sh 7                        # 最近 7 天，全部仓库
#   ./briar-mr-pending.sh scrm-mono                # 最近 30 天，scrm-mono 仓库
#   ./briar-mr-pending.sh 7 scrm-mono              # 最近 7 天，scrm-mono 仓库
#   ./briar-mr-pending.sh gitlab.qima-inc.com 7 scrm-mono

set -e

# --- 统一加载 .env 配置 ---
load_env() {
	# 1. 全局配置
	GLOBAL_ENV="$HOME/.config/briar-skills/.env"
	if [ -f "$GLOBAL_ENV" ]; then
		set -a; source "$GLOBAL_ENV"; set +a
	fi
	# 2. 向后兼容：项目内 .env
	PROJECT_ENV="$HOME/Documents/briar-display/.env"
	if [ -f "$PROJECT_ENV" ]; then
		set -a; source "$PROJECT_ENV"; set +a
	fi
}
load_env

# --- 智能参数解析 ---
DOMAIN="gitlab.qima-inc.com"
DAYS=30
PROJECT_FILTER=""

for arg in "$@"; do
	if [[ "$arg" =~ \. ]]; then
		DOMAIN="$arg"
	elif [[ "$arg" =~ ^[0-9]+$ ]]; then
		DAYS="$arg"
	elif [ -n "$arg" ]; then
		PROJECT_FILTER="$arg"
	fi
done

if [ -z "$GITLAB_TOKEN" ]; then
	echo "Error: GITLAB_TOKEN is not set."
	exit 1
fi

# 获取当前用户信息
USER_INFO=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" "https://${DOMAIN}/api/v4/user")
USER_ID=$(echo "$USER_INFO" | jq -r '.id // empty')
USER_NAME=$(echo "$USER_INFO" | jq -r '.name // empty')
USER_USERNAME=$(echo "$USER_INFO" | jq -r '.username // empty')

if [ -z "$USER_ID" ] || [ "$USER_ID" = "null" ]; then
	echo "Error: Failed to get current user info. Check GITLAB_TOKEN."
	exit 1
fi

# 计算 N 天前日期（兼容 macOS 和 Linux）
if date -v-"${DAYS}"d +"%Y-%m-%dT%H:%M:%SZ" >/dev/null 2>&1; then
	# macOS
	SINCE=$(date -v-"${DAYS}"d -u +"%Y-%m-%dT%H:%M:%SZ")
else
	# Linux
	SINCE=$(date -u -d "${DAYS} days ago" +"%Y-%m-%dT%H:%M:%SZ")
fi

# 构建过滤提示
FILTER_HINT=""
if [ -n "$PROJECT_FILTER" ]; then
	FILTER_HINT="，仓库: *${PROJECT_FILTER}*"
fi

echo "========================================"
echo "  未回复评论汇总"
echo "  用户: ${USER_NAME} (@${USER_USERNAME})"
echo "  范围: 最近 ${DAYS} 天 open 状态的 MR${FILTER_HINT}"
echo "========================================"
echo ""

# 获取 open 状态的 MR（跨项目）
MRS=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
	"https://${DOMAIN}/api/v4/merge_requests?author_id=${USER_ID}&state=opened&created_after=${SINCE}&per_page=100")

MR_COUNT=$(echo "$MRS" | jq 'length')
if [ "$MR_COUNT" -eq 0 ]; then
	echo "✅ 最近 ${DAYS} 天没有 open 状态的 MR。"
	exit 0
fi

TOTAL_UNREPLIED=0
TOTAL_MR_CHECKED=0

for ((i=0; i<MR_COUNT; i++)); do
	MR=$(echo "$MRS" | jq ".[$i]")
	MR_IID=$(echo "$MR" | jq -r '.iid')
	MR_TITLE=$(echo "$MR" | jq -r '.title')
	MR_WEB_URL=$(echo "$MR" | jq -r '.web_url')
	PROJECT_ID=$(echo "$MR" | jq -r '.project_id')
	SOURCE_BRANCH=$(echo "$MR" | jq -r '.source_branch')

	# 获取项目路径
	PROJECT_INFO=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
		"https://${DOMAIN}/api/v4/projects/${PROJECT_ID}")
	PROJECT_PATH=$(echo "$PROJECT_INFO" | jq -r '.path_with_namespace // empty')

	if [ -z "$PROJECT_PATH" ] || [ "$PROJECT_PATH" = "null" ]; then
		continue
	fi

	# --- 仓库过滤 ---
	if [ -n "$PROJECT_FILTER" ]; then
		if ! echo "$PROJECT_PATH" | grep -qi "$PROJECT_FILTER"; then
			continue
		fi
	fi

	TOTAL_MR_CHECKED=$((TOTAL_MR_CHECKED + 1))
	ENCODED_PATH=$(echo "$PROJECT_PATH" | sed 's/\//%2F/g')

	# 获取 discussions
	DISCUSSIONS=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
		"https://${DOMAIN}/api/v4/projects/${ENCODED_PATH}/merge_requests/${MR_IID}/discussions?per_page=100")

	DISCUSSION_COUNT=$(echo "$DISCUSSIONS" | jq 'length')
	MR_UNREPLIED=0
	MR_OUTPUT=""

	for ((d=0; d<DISCUSSION_COUNT; d++)); do
		DISCUSSION=$(echo "$DISCUSSIONS" | jq ".[$d]")
		NOTES=$(echo "$DISCUSSION" | jq '.notes')
		NOTE_COUNT=$(echo "$NOTES" | jq 'length')

		if [ "$NOTE_COUNT" -eq 0 ]; then
			continue
		fi

		FIRST_AUTHOR_ID=$(echo "$NOTES" | jq '.[0].author.id')
		FIRST_AUTHOR_NAME=$(echo "$NOTES" | jq -r '.[0].author.name')
		FIRST_BODY=$(echo "$NOTES" | jq -r '.[0].body')

		# 跳过用户自己发起的 discussion
		if [ "$FIRST_AUTHOR_ID" = "$USER_ID" ]; then
			continue
		fi

		# 检查是否有用户回复
		HAS_USER_REPLY=false
		for ((n=1; n<NOTE_COUNT; n++)); do
			NOTE_AUTHOR_ID=$(echo "$NOTES" | jq ".[$n].author.id")
			if [ "$NOTE_AUTHOR_ID" = "$USER_ID" ]; then
				HAS_USER_REPLY=true
				break
			fi
		done

		if [ "$HAS_USER_REPLY" = "true" ]; then
			continue
		fi

		# --- 过滤系统消息 ---
		BODY_LOWER=$(echo "$FIRST_BODY" | tr '[:upper:]' '[:lower:]')
		IS_SYSTEM=false

		case "$BODY_LOWER" in
			*"approved this merge request"*) IS_SYSTEM=true ;;
			*"mentioned in commit"*) IS_SYSTEM=true ;;
			*"enabled an automatic merge"*) IS_SYSTEM=true ;;
			*"merged this merge request"*) IS_SYSTEM=true ;;
			*"requested changes"*) IS_SYSTEM=true ;;
			*"本信息由机器人发出，无需回复"*) IS_SYSTEM=true ;;
			*"added 1 commit"*|*"added "*" commits"*) IS_SYSTEM=true ;;
		esac

		if [ "$IS_SYSTEM" = "true" ]; then
			continue
		fi

		# --- 过滤"已阅"类非实质性评论 ---
		if echo "$FIRST_BODY" | grep -qE '^已阅'; then
			continue
		fi

		# 过滤纯 LGTM / 表情 / 简短赞成
		TRIMMED=$(echo "$FIRST_BODY" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
		TRIMMED_LOWER=$(echo "$TRIMMED" | tr '[:upper:]' '[:lower:]')
		if [ "$TRIMMED_LOWER" = "lgtm" ] || [ "$TRIMMED_LOWER" = "👍" ] || [ "$TRIMMED_LOWER" = "👍🏻" ] || [ "$TRIMMED_LOWER" = "赞" ] || [ "$TRIMMED_LOWER" = "approved" ] || [ "$TRIMMED_LOWER" = "approve" ] || [ "$TRIMMED_LOWER" = "ok" ] || [ "$TRIMMED_LOWER" = "好的" ] || [ "$TRIMMED_LOWER" = "没问题" ]; then
			continue
		fi

		# --- 保留实质性评论 ---
		MR_UNREPLIED=$((MR_UNREPLIED + 1))
		TOTAL_UNREPLIED=$((TOTAL_UNREPLIED + 1))

		BODY_PREVIEW="$FIRST_BODY"
		if [ "${#BODY_PREVIEW}" -gt 200 ]; then
			BODY_PREVIEW="${BODY_PREVIEW:0:200}..."
		fi

		MR_OUTPUT="${MR_OUTPUT}  ❗ ${FIRST_AUTHOR_NAME}: ${BODY_PREVIEW}
"
	done

	if [ "$MR_UNREPLIED" -gt 0 ]; then
		echo "---"
		echo "📋 !${MR_IID} | ${PROJECT_PATH}"
		echo "   分支: ${SOURCE_BRANCH} → master"
		echo "   标题: ${MR_TITLE}"
		echo "   链接: ${MR_WEB_URL}"
		echo "   未回复评论 (${MR_UNREPLIED}条):"
		echo -n "$MR_OUTPUT"
		echo ""
	fi
done

echo "========================================"
if [ "$TOTAL_UNREPLIED" -eq 0 ]; then
	echo "✅ 没有需要回复的实质性评论"
else
	echo "⚠️  共 ${TOTAL_UNREPLIED} 条未回复实质性评论（检查了 ${TOTAL_MR_CHECKED} 个 MR）"
fi
echo "========================================"
