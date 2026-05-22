# 获取内网页面内容

**触发条件**：用户给出内网链接（URL 包含 `qima-inc`），要求"获取内容"、"看看这个页面"。

> ⚠️ **边界说明**：本 skill **只处理内网页面**（需浏览器登录态）。公开页面不归本 skill 处理，由 Agent 自然处理。
>
> 判断标准：URL 包含 `qima-inc` → 内网页面；否则 → 公开页面。

---

## 获取流程

### 1. 先尝试 HTTP 直接请求

```bash
URL="https://example.com/some-page"

CURL_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -L "$URL" 2>/dev/null || echo "000")
CURL_BODY=$(curl -s -L "$URL" 2>/dev/null | head -5)

if [ "$CURL_STATUS" = "200" ] && ! echo "$CURL_BODY" | grep -qi "登录\|login\|sign in"; then
    echo "Public page, fetched via curl."
    curl -s -L "$URL" 2>/dev/null
    exit 0
fi
```

### 2. curl 失败或遇到登录页 → 降级到 AppleScript + Chrome

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
        delay 4
        set pageTitle to title of newTab
        set pageText to execute newTab javascript "document.body.innerText"
        return "TITLE:" & pageTitle & "\n---BODY---\n" & pageText
    end tell
end tell
APPLEEOF
)

echo "$RESULT"
```

---

## 降级策略

| curl 结果 | 处理 |
|----------|------|
| HTTP 200，内容正常 | 直接输出 |
| HTTP 200，但内容含"登录/Login" | 降级到 AppleScript |
| HTTP 302/401/403/000 | 降级到 AppleScript |
| AppleScript 失败 | 提示用户开启 Chrome 支持或手动复制 |

---

## 注意事项

1. **Chrome 文件锁**：SQLite 中的 cookie 不是实时的，不能通过复制 `~/Library/Application Support/Google/Chrome/Profile 1/Cookies` 来获取登录态
2. **AppleScript 获取失败**时，提示用户开启 Chrome → View → Developer → Allow JavaScript from Apple Events，或手动复制页面内容
3. **超时控制**：AppleScript 等待页面加载的时间根据网络状况调整（通常 3-5 秒）
