#!/bin/bash
set -e

# briar-context.sh - 获取 URL 对应的页面上下文信息
# 用法: ./briar-context.sh <url>

URL="$1"
if [ -z "$URL" ]; then
	echo "Usage: $0 <url>"
	exit 1
fi

# --- 统一加载 .env 配置 ---
load_env() {
	# 1. 全局配置
	GLOBAL_ENV="$HOME/.config/briar-skills/.env"
	if [ -f "$GLOBAL_ENV" ]; then
		# shellcheck source=/dev/null
		set -a; source "$GLOBAL_ENV"; set +a
	fi
	# 2. 向后兼容：项目内 .env
	PROJECT_ENV="$HOME/Documents/briar-display/.env"
	if [ -f "$PROJECT_ENV" ]; then
		# shellcheck source=/dev/null
		set -a; source "$PROJECT_ENV"; set +a
	fi
}
load_env

# --- 判断信息源类型 ---
if echo "$URL" | grep -qE 'jira\..*/browse/'; then
	TYPE="jira"
elif echo "$URL" | grep -qE 'gitlab\..*/-/merge_requests/'; then
	TYPE="gitlab-mr"
elif echo "$URL" | grep -qE 'gitlab\..*/-/wikis/'; then
	TYPE="gitlab-wiki"
elif echo "$URL" | grep -qE 'qima-inc'; then
	TYPE="intranet"
else
	echo "[briar-context] Non-intranet URL, skipping."
	exit 0
fi

echo "[briar-context] Detected type: $TYPE"
echo "[briar-context] URL: $URL"
echo ""

# --- GitLab MR: 优先用 API ---
if [ "$TYPE" = "gitlab-mr" ]; then
	if [ -z "$GITLAB_TOKEN" ]; then
		echo "[briar-context] No GITLAB_TOKEN found."
		echo "  Set it in ~/.config/briar-skills/.env or $HOME/Documents/briar-display/.env"
		exit 1
	fi

	# 解析 URL: https://gitlab.qima-inc.com/wsc-node/wsc-pc-channel/-/merge_requests/936
	DOMAIN=$(echo "$URL" | sed -E 's|https?://([^/]+)/.*|\1|')
	PROJECT_PATH=$(echo "$URL" | sed -E 's|https?://[^/]+/([^/]+/[^/]+)/-/merge_requests/.*|\1|')
	MR_IID=$(echo "$URL" | sed -E 's|.*/-/merge_requests/([0-9]+).*|\1|')
	ENCODED_PATH=$(echo "$PROJECT_PATH" | sed 's/\//%2F/g')

	echo "[briar-context] Fetching MR info via GitLab API..."
	MR_INFO=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
		"https://$DOMAIN/api/v4/projects/$ENCODED_PATH/merge_requests/$MR_IID")

	TITLE=$(echo "$MR_INFO" | jq -r '.title // empty')
	SOURCE=$(echo "$MR_INFO" | jq -r '.source_branch // empty')
	TARGET=$(echo "$MR_INFO" | jq -r '.target_branch // empty')
	DESC=$(echo "$MR_INFO" | jq -r '.description // empty')
	STATE=$(echo "$MR_INFO" | jq -r '.state // empty')

	echo "【MR 上下文】!$MR_IID"
	echo "- 标题: $TITLE"
	echo "- 分支: $SOURCE → $TARGET"
	echo "- 状态: $STATE"
	echo "- 描述: $DESC"
	echo ""

	# 同时获取 diff（如果 diff 不大）
	DIFF=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
		"https://$DOMAIN/api/v4/projects/$ENCODED_PATH/merge_requests/$MR_IID/changes" | jq -r '.changes[] | "\(.new_path): +\(.additions)/-\(.deletions)"' 2>/dev/null | head -20)
	if [ -n "$DIFF" ]; then
		echo "- 变更文件:"
		echo "$DIFF" | sed 's/^/  /'
	fi

	# 自动发现 MR 描述中的 Jira ticket 并抓取
	JIRA_TICKET=$(echo "$DESC" | grep -oE '[A-Z]+-[0-9]+' | head -1)
	if [ -n "$JIRA_TICKET" ]; then
		echo ""
		echo "[briar-context] Found Jira ticket $JIRA_TICKET in MR description, fetching..."
		JIRA_URL="https://jira.qima-inc.com/browse/$JIRA_TICKET"
		"$0" "$JIRA_URL" 2>/dev/null | sed 's/^/  /' || true
	fi

	exit 0
fi

# --- Jira: 优先用 REST API (Linux) / AppleScript (macOS) ---
if [ "$TYPE" = "jira" ]; then
	# 提取 ticket key
	TICKET=$(echo "$URL" | grep -oE '[A-Z]+-[0-9]+' | head -1)
	if [ -z "$TICKET" ]; then
		echo "[briar-context] Could not extract ticket key from URL."
		exit 1
	fi

	JIRA_API_URL="https://jira.qima-inc.com/rest/api/2/issue/$TICKET"

	# Linux: 优先用 REST API + basic auth
	if [[ "$OSTYPE" == "linux-gnu"* ]]; then
		# 优先 API token，次选用户名密码
		AUTH=""
		if [ -n "$JIRA_API_TOKEN" ]; then
			AUTH="-u $JIRA_USERNAME:$JIRA_API_TOKEN"
		elif [ -n "$JIRA_USERNAME" ] && [ -n "$JIRA_PASSWORD" ]; then
			AUTH="-u $JIRA_USERNAME:$JIRA_PASSWORD"
		fi

		if [ -n "$AUTH" ]; then
			echo "[briar-context] Fetching Jira via REST API (Linux)..."
			RESPONSE=$(curl -s $AUTH "$JIRA_API_URL" 2>/dev/null || true)

			if [ -n "$RESPONSE" ] && echo "$RESPONSE" | jq -e '.key' >/dev/null 2>&1; then
				# 成功获取，结构化输出
				KEY=$(echo "$RESPONSE" | jq -r '.key')
				SUMMARY=$(echo "$RESPONSE" | jq -r '.fields.summary // empty')
				DESC_HTML=$(echo "$RESPONSE" | jq -r '.fields.description // empty')
				STATUS=$(echo "$RESPONSE" | jq -r '.fields.status.name // empty')
				PRIORITY=$(echo "$RESPONSE" | jq -r '.fields.priority.name // empty')
				ISSUE_TYPE=$(echo "$RESPONSE" | jq -r '.fields.issuetype.name // empty')
				ASSIGNEE=$(echo "$RESPONSE" | jq -r '.fields.assignee.displayName // empty')
				REPORTER=$(echo "$RESPONSE" | jq -r '.fields.reporter.displayName // empty')
				CREATED=$(echo "$RESPONSE" | jq -r '.fields.created // empty')
				RESOLUTIONDATE=$(echo "$RESPONSE" | jq -r '.fields.resolutiondate // empty')
				PROJECT=$(echo "$RESPONSE" | jq -r '.fields.project.name // empty')

				echo "【Jira 上下文】$KEY"
				echo "- 标题: $SUMMARY"
				echo "- 类型: $ISSUE_TYPE"
				echo "- 项目: $PROJECT"
				echo "- 状态: $STATUS"
				echo "- 优先级: $PRIORITY"
				echo "- 报告人: $REPORTER"
				echo "- 经办人: $ASSIGNEE"
				echo "- 创建时间: $CREATED"
				if [ -n "$RESOLUTIONDATE" ] && [ "$RESOLUTIONDATE" != "null" ]; then
					echo "- 解决时间: $RESOLUTIONDATE"
				fi
				if [ -n "$DESC_HTML" ] && [ "$DESC_HTML" != "null" ]; then
					# 简单去除 HTML 标签
					DESC_TEXT=$(echo "$DESC_HTML" | sed 's/<[^>]*>//g' | sed 's/&nbsp;/ /g' | sed 's/&lt;/</g' | sed 's/&gt;/>/g' | sed 's/&amp;/\&/g')
					echo "- 描述: $DESC_TEXT"
				fi
				exit 0
			else
				echo "[briar-context] Jira API failed, falling back..."
			fi
		else
			echo "[briar-context] No Jira credentials found."
			echo "  Set JIRA_USERNAME + JIRA_PASSWORD (or JIRA_API_TOKEN) in ~/.config/briar-skills/.env"
		fi
	fi

	# macOS: AppleScript + Chrome
	if [[ "$OSTYPE" == "darwin"* ]]; then
		echo "[briar-context] Using AppleScript + Chrome..."

		if [ ! -d "/Applications/Google Chrome.app" ]; then
			echo "[briar-context] ERROR: Google Chrome not found."
			exit 1
		fi

		JS_EXTRACT='(function() { var title = document.title || ""; var main = document.querySelector("[data-testid*=\"issue-body\"]") || document.querySelector("#issue-content") || document.querySelector(".issue-view") || document.querySelector("[role=\"main\"]") || document.body; var text = main.innerText || ""; return "TITLE:" + title + "\\n---BODY---\\n" + text; })()'

		RESULT=$(osascript <<APPLEEOF 2>&1
tell application "Google Chrome"
    activate
    tell front window
        set newTab to make new tab at end of tabs
        set URL of newTab to "$URL"
        repeat 20 times
            delay 0.5
            set readyState to execute newTab javascript "document.readyState"
            if readyState is "complete" then exit repeat
        end repeat
        delay 3
        set pageResult to execute newTab javascript "$JS_EXTRACT"
        close newTab
        return pageResult
    end tell
end tell
APPLEEOF
)

		if [ $? -ne 0 ]; then
			echo "[briar-context] AppleScript failed: $RESULT"
			echo "[briar-context] Hint: Make sure Chrome → View → Developer → Allow JavaScript from Apple Events is enabled."
			exit 1
		fi

		echo "$RESULT"
		exit 0
	fi

	# Linux 无 creds / API 失败 → 提示用户
	echo "[briar-context] Failed to fetch Jira page."
	echo "Linux options:"
	echo "  1. Set JIRA_USERNAME + JIRA_PASSWORD in ~/.config/briar-skills/.env"
	echo "  2. Set JIRA_API_TOKEN in ~/.config/briar-skills/.env"
	echo "  3. Copy-paste the page content manually"
	exit 1
fi

# --- 通用内网页面: curl → AppleScript fallback ---
if [ "$TYPE" = "intranet" ] || [ "$TYPE" = "gitlab-wiki" ]; then
	TMP_BODY=$(mktemp)
	CURL_STATUS=$(curl -s -o "$TMP_BODY" -w "%{http_code}" -L "$URL" 2>/dev/null || echo "000")
	CURL_BODY=$(head -20 "$TMP_BODY")

	if [ "$CURL_STATUS" = "200" ] && ! echo "$CURL_BODY" | grep -qi "登录\|login\|sign in"; then
		echo "[briar-context] Public page, fetched via curl."
		echo "---RAW_BODY---"
		cat "$TMP_BODY"
		rm -f "$TMP_BODY"
		exit 0
	fi
	rm -f "$TMP_BODY"

	# curl 失败或遇到登录页
	echo "[briar-context] Page requires login."

	# macOS: AppleScript
	if [[ "$OSTYPE" == "darwin"* ]]; then
		echo "[briar-context] Using AppleScript + Chrome..."

		if [ ! -d "/Applications/Google Chrome.app" ]; then
			echo "[briar-context] ERROR: Google Chrome not found."
			exit 1
		fi

		JS_EXTRACT='(function() { var title = document.title || ""; var main = document.querySelector("main") || document.querySelector("article") || document.querySelector("[role=\"main\"]") || document.querySelector(".content") || document.body; var text = main.innerText || ""; return "TITLE:" + title + "\\n---BODY---\\n" + text; })()'

		RESULT=$(osascript <<APPLEEOF 2>&1
tell application "Google Chrome"
    activate
    tell front window
        set newTab to make new tab at end of tabs
        set URL of newTab to "$URL"
        repeat 20 times
            delay 0.5
            set readyState to execute newTab javascript "document.readyState"
            if readyState is "complete" then exit repeat
        end repeat
        delay 3
        set pageResult to execute newTab javascript "$JS_EXTRACT"
        close newTab
        return pageResult
    end tell
end tell
APPLEEOF
)

		if [ $? -ne 0 ]; then
			echo "[briar-context] AppleScript failed: $RESULT"
			echo "[briar-context] Hint: Make sure Chrome → View → Developer → Allow JavaScript from Apple Events is enabled."
			exit 1
		fi

		echo "$RESULT"
		exit 0
	fi

	# Linux: 无更多自动方案
	echo "[briar-context] Linux: page requires login and no credentials available."
	echo "  Options: copy-paste content manually, or provide cookies."
	exit 1
fi

echo "[briar-context] Unknown type or unsupported URL."
exit 1
