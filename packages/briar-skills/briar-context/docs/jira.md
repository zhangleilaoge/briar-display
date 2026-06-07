# 获取 Jira 内容

**触发条件**：用户给出 Jira 链接，要求"看看这个需求"、"获取 Jira 内容"。

---

## 平台差异

| 平台 | 方式 | 前置要求 |
|------|------|---------|
| **Linux** | Jira REST API + basic auth | `JIRA_USERNAME` + `JIRA_PASSWORD`（或 `JIRA_API_TOKEN`）已配置在 `.env` |
| **macOS** | AppleScript + Chrome | Chrome 已安装，已开启"允许 Apple 事件中的 JavaScript" |

---

## Linux: REST API + basic auth（推荐）

### 凭证配置

在 `~/.config/briar-skills/.env` 中配置：

```bash
JIRA_USERNAME="zhanglei_zl"
JIRA_PASSWORD="your_password"
# 或者使用 API token（优先级更高）：
# JIRA_API_TOKEN="your_api_token"
```

### 获取流程

```bash
TICKET="CSWT-191480"
JIRA_API_URL="https://jira.qima-inc.com/rest/api/2/issue/$TICKET"

# 优先 API token，次选用户名密码
if [ -n "$JIRA_API_TOKEN" ]; then
    AUTH="-u $JIRA_USERNAME:$JIRA_API_TOKEN"
elif [ -n "$JIRA_USERNAME" ] && [ -n "$JIRA_PASSWORD" ]; then
    AUTH="-u $JIRA_USERNAME:$JIRA_PASSWORD"
fi

RESPONSE=$(curl -s $AUTH "$JIRA_API_URL")
```

### 结构化输出

```bash
KEY=$(echo "$RESPONSE" | jq -r '.key')
SUMMARY=$(echo "$RESPONSE" | jq -r '.fields.summary')
STATUS=$(echo "$RESPONSE" | jq -r '.fields.status.name')
PRIORITY=$(echo "$RESPONSE" | jq -r '.fields.priority.name')
ISSUE_TYPE=$(echo "$RESPONSE" | jq -r '.fields.issuetype.name')
ASSIGNEE=$(echo "$RESPONSE" | jq -r '.fields.assignee.displayName')
REPORTER=$(echo "$RESPONSE" | jq -r '.fields.reporter.displayName')
CREATED=$(echo "$RESPONSE" | jq -r '.fields.created')
RESOLUTIONDATE=$(echo "$RESPONSE" | jq -r '.fields.resolutiondate')
PROJECT=$(echo "$RESPONSE" | jq -r '.fields.project.name')
DESC_HTML=$(echo "$RESPONSE" | jq -r '.fields.description')

# HTML 去标签
DESC_TEXT=$(echo "$DESC_HTML" | sed 's/<[^>]*>//g')
```

输出示例：
```
【Jira 上下文】CSWT-191480
- 标题: 切换团购核销和客资中心tab时, 店铺列表没有返回
- 类型: Bug
- 项目: 测试问题管理
- 状态: 已关闭
- 优先级: 严重
- 报告人: 许筱燕(许筱燕)
- 经办人: 张磊
- 创建时间: 2026-05-21T15:02:09.000+0800
- 解决时间: 2026-05-21T17:09:25.000+0800
- 描述: 期望结果：切换团购核销和客资中心tab的时候, 拿着商家选择的店铺重新请求一次接口
```

---

## macOS: AppleScript + Chrome

**检查 Chrome AppleScript 支持**：
```bash
osascript -e 'tell application "Google Chrome" to return version'
```

**开启方式**（如未开启）：
> 菜单栏 → **查看 → 开发者 → 允许 Apple 事件中的 JavaScript**

**获取脚本**：
```bash
RESULT=$(osascript <<APPLEEOF
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
        set pageResult to execute newTab javascript "
(function() {
  var title = document.title || '';
  var main = document.querySelector('[data-testid*=\"issue-body\"]')
    || document.querySelector('#issue-content')
    || document.querySelector('.issue-view')
    || document.querySelector('[role=\"main\"]')
    || document.body;
  var text = main.innerText || '';
  return 'TITLE:' + title + '\\n---BODY---\\n' + text;
})()"
        close newTab
        return pageResult
    end tell
end tell
APPLEEOF
)
```

---

## 注意事项

1. **获取后自动关闭 Chrome 标签页**，无需手动清理
2. **SPA 等待**：Jira 为单页应用，`document.readyState === 'complete'` 后仍需固定等待 **3 秒**
3. **超时控制**：AppleScript 轮询 `document.readyState`，最长等待 10 秒
4. **Linux 优先 API**：Linux 服务器没有浏览器登录态，REST API 是唯一自动方案
