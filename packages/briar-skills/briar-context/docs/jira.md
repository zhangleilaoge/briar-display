# 获取 Jira 内容

**触发条件**：用户给出 Jira 链接，要求"看看这个需求"、"获取 Jira 内容"。

> Jira 页面需要浏览器登录态，无法直接 curl 获取。使用 **AppleScript + Chrome** 方案。

---

## 前置要求

- macOS 系统
- Chrome 已安装（`/Applications/Google Chrome.app`）
- Chrome 已开启**"允许 Apple 事件中的 JavaScript"**

**检查 Chrome AppleScript 支持**：
```bash
osascript -e 'tell application "Google Chrome" to return version'
```

**开启方式**（如未开启）：
> 菜单栏 → **查看 → 开发者 → 允许 Apple 事件中的 JavaScript**

---

## 获取流程

```bash
URL="https://jira.qima-inc.com/browse/CSWT-191480"

# 1. 检查 Chrome
if [ ! -d "/Applications/Google Chrome.app" ]; then
    echo "ERROR: Google Chrome not found."
    exit 1
fi

# 2. 用 AppleScript 打开页面并获取内容（智能提取主内容区）
RESULT=$(osascript <<APPLEEOF
tell application "Google Chrome"
    activate
    tell front window
        set newTab to make new tab at end of tabs
        set URL of newTab to "$URL"
        -- 轮询等待页面加载，最多 10 秒
        repeat 20 times
            delay 0.5
            set readyState to execute newTab javascript "document.readyState"
            if readyState is "complete" then exit repeat
        end repeat
        -- Jira 为 SPA，readyState complete 后仍需等待 3 秒让动态内容渲染
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

# 3. 判断是否成功
if [ $? -ne 0 ]; then
    echo "AppleScript failed: $RESULT"
    echo "Hint: Make sure Chrome → View → Developer → Allow JavaScript from Apple Events is enabled."
    exit 1
fi

echo "$RESULT"
```

---

## 结构化输出

获取原始内容后，提取关键字段：

```
【Jira 上下文】CSWT-191480
- 标题: xxx
- 类型: Bug / 需求 / 任务
- 状态: 进行中 / 已解决 / 已关闭
- 优先级: P0 / P1 / P2
- 描述: xxx
- 期望结果: xxx
- 实际结果: xxx
- 相关 MR: https://gitlab.../merge_requests/936
- 评论摘要: xxx
```

---

## 注意事项

1. **获取后自动关闭 Chrome 标签页**，无需手动清理
2. **Cookie 安全**：通过 AppleScript 获取的 cookie 是内存中的实时值，不要持久化到日志或文件
3. **SPA 等待**：Jira 为单页应用，`document.readyState === 'complete'` 后仍需固定等待 **3 秒**，让 JavaScript 动态渲染 Issue 主体内容，否则可能返回空内容
4. **超时控制**：AppleScript 轮询 `document.readyState`，页面加载完成后固定等待 3 秒再提取，最长等待 10 秒
