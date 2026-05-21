---
name: briar-context
description: >
  获取 Agent 上下文信息。支持通过 URL 获取 Jira、GitLab MR/Wiki、内部文档等页面内容，
  作为下游技能（如 briar-fix、briar-mr）的前置信息输入。
  触发场景：
  1. 用户给出 Jira 链接，要求"看看这个需求"、"获取 Jira 内容" → 触发【获取 Jira 内容】
  2. 用户在 review/fix MR 前，要求"获取这个 MR 的关联需求/背景信息" → 触发【获取 MR 背景信息】（辅助 briar-mr，不独立处理 MR 业务）
  3. 用户给出任意内网链接，要求"获取内容"、"看看这个页面" → 触发【获取页面内容】
  4. 用户给出多个链接，要求"整理上下文"、"汇总信息" → 触发【汇总上下文】

  ⚠️ **边界说明**：用户只说"MR 链接"而没有明确意图时（如只丢一个 `/-/merge_requests/932` 链接），不归本 skill 处理，由 briar-mr 默认触发【获取评论】。
---

# briar-context: Agent 上下文获取

## 概述

本 skill 用于从各种链接中提取**结构化上下文信息**，供其他 skill 使用。

**与 briar-mr 的分工**：
- `briar-context`：获取**背景信息/页面内容**（Jira 需求、内网文档、MR 的关联信息）
- `briar-mr`：处理**MR 业务操作**（review、comment、reply、fix、pipeline）

下游 skill 可以通过本 skill 获取：
- **briar-fix**：修复代码前获取 Jira 需求描述、MR diff 背景
- **briar-mr**：Review MR 前获取关联的 Jira 需求背景（MR 本身的评论/review 由 briar-mr 处理）
- 其他需要页面内容的场景

---

## 信息源分类与获取策略

### 分类规则（按 URL 特征）

| 类型 | URL 特征 | 获取策略 | 备注 |
|------|---------|---------|------|
| 需登录内网页 | 任意需要浏览器登录态的系统（如 Jira、内部平台） | AppleScript + Chrome | 利用浏览器已有的登录态 |
| GitLab MR（背景） | 包含 `gitlab.`、`/-/merge_requests/` | GitLab API | **仅获取 MR 元信息**（标题、描述、关联 Jira），不处理评论/review |
| GitLab Wiki | 包含 `gitlab.`、`/-/wikis/` | GitLab API / 页面抓取 | 获取 Wiki 页面内容 |
| 公开页面 | 任意公开 HTTP/HTTPS | `curl` / `fetch` | 通用页面抓取 |

**判断逻辑**：
- 如果是 GitLab 且有 Token → 走 GitLab API
- 如果页面需要登录态（已知内网系统，或 `curl` 返回登录页） → 走 AppleScript + Chrome
- 其他 → 先尝试 `curl`，如果返回登录页再降级到 AppleScript

---

## 通用获取方式

### 方式一：HTTP 直接请求（curl）

适用于公开页面、有 API Token 的系统。

```bash
curl -s -L "$URL"
```

### 方式二：GitLab API

```bash
export GITLAB_TOKEN=$(grep GITLAB_TOKEN /Users/zhanglei/Documents/projects/briar-display/packages/briar-skills/.env | cut -d= -f2-)
ENCODED_PATH=$(echo "$PROJECT_PATH" | sed 's/\//%2F/g')

curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "https://$DOMAIN/api/v4/projects/$ENCODED_PATH/merge_requests/$MR_IID"
```

### 方式三：AppleScript + Chrome（需登录态页面）

**前提条件**：
- macOS 系统
- Chrome 已安装（`/Applications/Google Chrome.app`）
- Chrome 已开启**"允许 Apple 事件中的 JavaScript"**

**检查 Chrome AppleScript 支持**：
```bash
osascript -e 'tell application "Google Chrome" to return version'
```

**开启方式**（如未开启）：
> 菜单栏 → **查看 → 开发者 → 允许 Apple 事件中的 JavaScript**

**通用获取脚本**：

```applescript
tell application "Google Chrome"
    activate
    tell front window
        set newTab to make new tab at end of tabs
        set URL of newTab to "TARGET_URL"
        delay 4
        set pageTitle to title of newTab
        set pageText to execute newTab javascript "document.body.innerText"
        set cookies to execute newTab javascript "document.cookie"
        -- 通用图片/附件 URL 提取：查找页面中的图片和附件链接
        set imageUrls to execute newTab javascript "
          Array.from(document.querySelectorAll('a, img')).map(el => el.href || el.src).filter(u => u && (u.match(/\\.(png|jpg|jpeg|gif|webp)$/i) || u.includes('attachment') || u.includes('download'))).join('\\n')
        "
        return "TITLE:" & pageTitle & "\n---COOKIES---\n" & cookies & "\n---BODY---\n" & pageText & "\n---IMAGES---\n" & imageUrls
    end tell
end tell
```

**获取后清理**（可选，询问用户）：
```applescript
tell application "Google Chrome"
    tell front window to close active tab
end tell
```

---

## 图片/附件识别（通用策略）

如果页面包含截图或图片附件（`---IMAGES---` 后有内容），**必须**主动下载并识别，不能只列出文件名。

### 坑点与解决路径

1. **`curl` + `document.cookie` 大概率会失败**
   - `document.cookie` 只能获取**非 HTTP-only** 的 cookie
   - 大多数内网系统（Jira、内部平台）的核心会话 cookie（如 `JSESSIONID`）都是 **HTTP-only**
   - `curl --cookie "$DOCUMENT_COOKIE"` 下载附件几乎一定会被重定向到登录页

2. **Chrome 的 Cookies SQLite 数据库不可信**
   - `~/Library/Application Support/Google/Chrome/Profile 1/Cookies` 可能为空或不包含当前会话的实时 cookie
   - Chrome 可能将 session cookie 保存在内存中，不会立即持久化到 SQLite

3. **base64 直传不可行**
   - 通过 AppleScript `execute javascript` 返回图片的 base64，`stdout` 很容易因超长输出而截断或报错

### 推荐方案：通过 Chrome 自身触发下载

这是最可靠的绕过方式——利用浏览器已有的完整登录态（含 HTTP-only cookie）让 Chrome 自己下载附件。

```applescript
tell application "Google Chrome"
    tell front window
        set imgTab to make new tab at end of tabs
        set URL of imgTab to "ATTACHMENT_URL"
        delay 3
        execute imgTab javascript "
            var img = document.querySelector('img');
            if (img) {
                var canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                var link = document.createElement('a');
                link.href = canvas.toDataURL('image/png');
                link.download = 'context_image.png';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        "
        delay 2
    end tell
end tell
```

然后到 `~/Downloads/` 目录读取下载的文件，并用 `ReadMediaFile` 识别。

> 如果目标页面不是直接展示图片（而是触发下载），上述方式可能不适用。此时可尝试在 Chrome 中打开附件链接后，观察 URL 是否变化，或检查 Network 面板找到实际请求地址。

---

## 结构化输出

获取原始内容后，提取关键字段并结构化输出，方便下游 skill 消费。

**通用页面输出模板**：
```
【页面上下文】URL
- 标题: xxx
- 关键状态/字段: xxx（根据页面类型提取，如 Bug 状态、优先级、作者等）
- 正文摘要: xxx
- 评论/讨论摘要: xxx

**附件/截图分析**:
（如果页面包含截图或图片附件，在此处结合图片内容进行描述：
- 图片展示了什么界面/场景？
- 图片中有什么关键信息（错误提示、数据状态、UI 状态）？
- 图片内容与文字描述是否一致？）
```

**MR 背景信息输出模板**（供 briar-mr 使用，不替代 briar-mr 的评论获取）：
```
【MR 背景】!936
- 标题: xxx
- 来源分支: feat/xxx → 目标分支: feat/yyy
- 描述: xxx
- 变更文件数: N
- 关联 Jira: CSWT-191480
```

---

## 注意事项

1. **AppleScript 会实际打开 Chrome 标签页**，获取完成后应询问用户是否关闭
2. **Cookie 安全**：通过 AppleScript 获取的 cookie 是内存中的实时值，不要持久化到日志或文件
3. **Chrome 文件锁**：SQLite 中的 cookie 不是实时的，不能通过复制 `~/Library/Application Support/Google/Chrome/Profile 1/Cookies` 来获取登录态
4. **降级策略**：如果 AppleScript 获取失败（Chrome 未开启支持），提示用户开启或手动复制页面内容
5. **超时控制**：AppleScript 等待页面加载的时间根据网络状况调整（通常 3-5 秒）
6. **图片附件必须主动识别**：遇到页面中包含截图/图片附件时，不能只列出文件名，必须下载图片并用 `ReadMediaFile` 识别内容，将图片信息融入回答

---

## 总入口脚本

```bash
./packages/briar-skills/briar-context/scripts/briar-context.sh <url>
```

脚本自动判断 URL 类型，选择最佳获取方式，输出结构化上下文。
