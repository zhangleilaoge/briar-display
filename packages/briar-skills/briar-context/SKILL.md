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

## 行为索引

| 行为 | 触发关键词 | 文档 | 工具 |
|------|-----------|------|------|
| 获取 Jira 内容 | "看看这个需求"、"获取 Jira"、Jira 链接 | [docs/jira.md](docs/jira.md) | AppleScript + Chrome |
| 获取 MR 背景信息 | "获取 MR 的关联需求"、"MR 背景" | [docs/gitlab-mr.md](docs/gitlab-mr.md) | GitLab API / AppleScript fallback |
| 获取内网页面 | "获取内容"、"看看这个页面"、内网链接（含 `qima-inc`） | [docs/generic.md](docs/generic.md) | curl → AppleScript fallback |
| 汇总上下文 | "整理上下文"、"汇总信息"、多个链接 | — | 多次调用上述能力后汇总 |

---

## 公共基础设施

### URL 解析与路由

入口脚本根据 URL 特征自动判断信息源类型：

```bash
URL="https://jira.qima-inc.com/browse/CSWT-191480"

if echo "$URL" | grep -qE 'jira\..*/browse/'; then
    TYPE="jira"
elif echo "$URL" | grep -qE 'gitlab\..*/-/merge_requests/'; then
    TYPE="gitlab-mr-bg"  # 仅获取 MR 背景信息，MR 业务操作由 briar-mr 处理
elif echo "$URL" | grep -qE 'gitlab\..*/-/wikis/'; then
    TYPE="gitlab-wiki"
elif echo "$URL" | grep -qE 'qima-inc'; then
    TYPE="intranet"
else
    # 非内网页面，不归本 skill 处理，让 Agent 自然处理
    echo "Non-intranet URL, skipping briar-context."
    exit 0
fi
```

| 类型 | URL 特征 | 处理方式 |
|------|---------|---------|
| Jira | 包含 `jira.`、`/browse/` | AppleScript + Chrome |
| GitLab MR（背景） | 包含 `gitlab.`、`/-/merge_requests/` | GitLab API → AppleScript fallback |
| GitLab Wiki | 包含 `gitlab.`、`/-/wikis/` | GitLab API / 页面抓取 |
| 内网页面 | 包含 `qima-inc` 的任意 URL | curl → AppleScript fallback |

### AppleScript + Chrome 基础设施

多个信息源（Jira、内网页面、GitLab MR fallback）共用此基础设施。

**前置要求**：
- macOS 系统
- Chrome 已安装（`/Applications/Google Chrome.app`）
- Chrome 已开启**"允许 Apple 事件中的 JavaScript"**

**检查支持**：
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
        return "TITLE:" & pageTitle & "\n---BODY---\n" & pageText
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
