#!/bin/bash
set -e

# briar-context.sh - 获取 URL 对应的页面上下文信息
# 用法: ./briar-context.sh <url>

URL="$1"
if [ -z "$URL" ]; then
    echo "Usage: $0 <url>"
    exit 1
fi

# 判断信息源类型
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
    # 读取 GITLAB_TOKEN：优先环境变量 → 全局配置 → 项目内配置
    if [ -z "$GITLAB_TOKEN" ]; then
        GLOBAL_ENV="$HOME/.config/briar-skills/.env"
        if [ -f "$GLOBAL_ENV" ]; then
            GITLAB_TOKEN=$(grep GITLAB_TOKEN "$GLOBAL_ENV" | cut -d= -f2-)
        fi
    fi
    # 向后兼容：如果仍在 briar-display 项目内
    if [ -z "$GITLAB_TOKEN" ]; then
        PROJECT_ENV="$HOME/Documents/projects/briar-display/packages/briar-skills/.env"
        if [ -f "$PROJECT_ENV" ]; then
            GITLAB_TOKEN=$(grep GITLAB_TOKEN "$PROJECT_ENV" | cut -d= -f2-)
        fi
    fi

    if [ -n "$GITLAB_TOKEN" ]; then
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
        exit 0
    else
        echo "[briar-context] No GITLAB_TOKEN found, falling back to page scraping..."
    fi
fi

# --- Jira / 内网页面: 使用 AppleScript + Chrome ---
if [ "$TYPE" = "jira" ] || [ "$TYPE" = "generic" ]; then
    # 先尝试 curl（公开页面）
    CURL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -L "$URL" 2>/dev/null || echo "000")
    CURL_BODY=$(curl -s -L "$URL" 2>/dev/null | head -5)

    if [ "$CURL_STATUS" = "200" ] && ! echo "$CURL_BODY" | grep -qi "登录\|login\|sign in"; then
        echo "[briar-context] Public page, fetched via curl."
        echo "---RAW_BODY---"
        curl -s -L "$URL" 2>/dev/null
        exit 0
    fi

    # curl 失败或遇到登录页，降级到 AppleScript + Chrome
    echo "[briar-context] Page requires login, using AppleScript + Chrome..."

    # 检查 Chrome 是否存在
    if [ ! -d "/Applications/Google Chrome.app" ]; then
        echo "[briar-context] ERROR: Google Chrome not found."
        exit 1
    fi

    RESULT=$(osascript <<APPLEEOF 2>&1
tell application "Google Chrome"
    activate
    tell front window
        set newTab to make new tab at end of tabs
        set URL of newTab to "$URL"
        delay 4
        set pageTitle to title of newTab
        set pageText to execute newTab javascript "document.body.innerText"
        return "TITLE:" & pageTitle & "\n---BODY---\n" & pageText
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

echo "[briar-context] Unknown type or unsupported URL."
exit 1
