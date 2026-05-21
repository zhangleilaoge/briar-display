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

## 支持的信息源

| 类型 | URL 特征 | 获取方式 | 备注 |
|------|---------|---------|------|
| Jira | 包含 `jira.`、`/browse/` | AppleScript + Chrome（需登录态） | 获取需求描述、背景信息 |
| GitLab MR（背景） | 包含 `gitlab.`、`/-/merge_requests/` | GitLab API | **仅获取 MR 元信息**（标题、描述、关联 Jira），不处理评论/review |
| GitLab Wiki | 包含 `gitlab.`、`/-/wikis/` | GitLab API / 页面抓取 | 获取 Wiki 页面内容 |
| 公开页面 | 任意公开 HTTP/HTTPS | `curl` / `fetch` | 通用页面抓取 |
| 需登录内网页 | 任意内网系统（有赞系） | AppleScript + Chrome | 内网系统登录态获取 |

---

## 核心流程

### 1. 解析 URL，判断信息源类型

```bash
URL="https://jira.qima-inc.com/browse/CSWT-191480"

if echo "$URL" | grep -qE 'jira\..*/browse/'; then
    TYPE="jira"
elif echo "$URL" | grep -qE 'gitlab\..*/-/merge_requests/'; then
    TYPE="gitlab-mr-bg"  # 仅获取 MR 背景信息，MR 业务操作由 briar-mr 处理
elif echo "$URL" | grep -qE 'gitlab\..*/-/wikis/'; then
    TYPE="gitlab-wiki"
else
    TYPE="generic"
fi
```

### 2. 选择获取方式

| 方式 | 适用场景 | 工具 |
|------|---------|------|
| **HTTP 直接请求** | 公开页面、有 API Token 的系统 | `curl` |
| **GitLab API** | GitLab MR / Wiki / 项目信息 | `curl` + `PRIVATE-TOKEN` |
| **AppleScript + Chrome** | 需要浏览器登录态的内网页面 | `osascript` |

**判断逻辑**：
- 如果是 GitLab 且有 Token → 走 GitLab API
- 如果是 Jira / 有赞内网系统 → 走 AppleScript + Chrome
- 其他 → 先尝试 `curl`，如果返回登录页再降级到 AppleScript

### 3. AppleScript + Chrome 获取页面（内网登录态）

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

**获取脚本**：
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
        return "TITLE:" & pageTitle & "\n---COOKIES---\n" & cookies & "\n---BODY---\n" & pageText
    end tell
end tell
```

**获取后清理**（可选，询问用户）：
```applescript
tell application "Google Chrome"
    tell front window to close active tab
end tell
```

### 4. GitLab API 获取 MR 信息

```bash
export GITLAB_TOKEN=$(grep GITLAB_TOKEN /Users/zhanglei/Documents/projects/briar-display/packages/briar-skills/.env | cut -d= -f2-)
ENCODED_PATH=$(echo "$PROJECT_PATH" | sed 's/\//%2F/g')

curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "https://$DOMAIN/api/v4/projects/$ENCODED_PATH/merge_requests/$MR_IID"
```

### 5. 结构化输出

获取原始内容后，提取关键字段并结构化输出，方便下游 skill 消费。

**Jira 输出模板**：
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

---

## 总入口脚本

```bash
./packages/briar-skills/briar-context/scripts/briar-context.sh <url>
```

脚本自动判断 URL 类型，选择最佳获取方式，输出结构化上下文。
