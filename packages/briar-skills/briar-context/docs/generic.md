# 获取内网页面内容

**触发条件**：用户给出内网链接（URL 包含 `qima-inc`），要求"获取内容"、"看看这个页面"。

> ⚠️ **边界说明**：本 skill **只处理内网页面**（需浏览器登录态）。公开页面不归本 skill 处理，由 Agent 自然处理。
>
> 判断标准：URL 包含 `qima-inc` → 内网页面；否则 → 公开页面。

---

## 获取流程

### 1. 先尝试 HTTP 直接请求（单次请求）

```bash
URL="https://example.com/some-page"

TMP_BODY=$(mktemp)
CURL_STATUS=$(curl -s -o "$TMP_BODY" -w "%{http_code}" -L "$URL" 2>/dev/null || echo "000")
CURL_BODY=$(head -20 "$TMP_BODY")

if [ "$CURL_STATUS" = "200" ] && ! echo "$CURL_BODY" | grep -qi "登录\|login\|sign in"; then
    echo "Public page, fetched via curl."
    cat "$TMP_BODY"
    rm -f "$TMP_BODY"
    exit 0
fi
rm -f "$TMP_BODY"
```

> 合并为一次请求：body 写入临时文件，状态码通过 `-w` 获取，避免重复 curl。

### 2. curl 失败或遇到登录页 → 降级

| 平台 | 降级方案 |
|------|---------|
| **macOS** | AppleScript + Chrome（复用浏览器登录态） |
| **Linux** | 提示用户手动复制内容，或提供 cookie |

---

## macOS: AppleScript + Chrome

```bash
echo "Page requires login, using AppleScript + Chrome..."

if [ ! -d "/Applications/Google Chrome.app" ]; then
    echo "ERROR: Google Chrome not found."
    exit 1
fi

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
  var main = document.querySelector('main')
    || document.querySelector('article')
    || document.querySelector('[role=\"main\"]')
    || document.querySelector('.content')
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

echo "$RESULT"
```

> 智能提取：优先抓取 `main` / `article` / `[role=main]` / `.content`，避免把导航栏、侧边栏等噪音一起带进来。

---

## Linux: 无浏览器登录态

Linux 服务器无法像 macOS 那样自动复用 Chrome 的登录 cookie。对于需要登录的内网页面：

1. **如果是 Jira** → 使用 `briar-context` 的 Jira REST API 方案（见 [jira.md](jira.md)）
2. **如果是 GitLab Wiki/MR** → 使用 GitLab API + `GITLAB_TOKEN`
3. **其他内网页面** → 请用户手动复制粘贴内容，或提供 `JSESSIONID`/`atlassian.xsrf.token` 等 cookie

---

## 降级策略

| curl 结果 | 处理 |
|----------|------|
| HTTP 200，内容正常 | 直接输出 |
| HTTP 200，但内容含"登录/Login" | macOS → AppleScript；Linux → 提示手动提供 |
| HTTP 302/401/403/000 | 同上 |
| AppleScript 失败 | 提示用户开启 Chrome 支持或手动复制 |

---

## 注意事项

1. **Chrome 文件锁**：SQLite 中的 cookie 不是实时的，不能通过复制 `~/Library/Application Support/Google/Chrome/Profile 1/Cookies` 来获取登录态
2. **AppleScript 获取失败**时，提示用户开启 Chrome → View → Developer → Allow JavaScript from Apple Events，或手动复制页面内容
3. **SPA 等待**：单页应用在 `document.readyState === 'complete'` 后仍需固定等待 **3 秒**
4. **自动关闭标签页**：获取完成后自动关闭新开的 Chrome 标签
5. **Linux 限制**：headless Chromium 没有浏览器 cookie，访问登录页会返回登录页面本身
