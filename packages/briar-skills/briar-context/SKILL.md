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
| 获取 Jira 内容 | "看看这个需求"、"获取 Jira"、Jira 链接 | [docs/jira.md](docs/jira.md) | Linux: REST API + basic auth / macOS: AppleScript + Chrome |
| 获取 MR 背景信息 | "获取 MR 的关联需求"、"MR 背景" | [docs/gitlab-mr.md](docs/gitlab-mr.md) | GitLab API |
| 获取内网页面 | "获取内容"、"看看这个页面"、内网链接（含 `qima-inc`） | [docs/generic.md](docs/generic.md) | curl → AppleScript fallback |
| 汇总上下文 | "整理上下文"、"汇总信息"、多个链接 | — | 多次调用上述能力后汇总 |

---

## 凭证配置

所有 briar skill 共用同一套 `.env` 加载机制：

1. **全局配置**（推荐）：`~/.config/briar-skills/.env`
2. **项目内配置**（向后兼容）：`~/Documents/briar-display/.env`

**初始化**：
```bash
mkdir -p "$HOME/.config/briar-skills"
cat > "$HOME/.config/briar-skills/.env" << 'EOF'
GITLAB_TOKEN="your_gitlab_token"
JIRA_USERNAME="zhanglei_zl"
JIRA_PASSWORD="your_password"
EOF
chmod 600 "$HOME/.config/briar-skills/.env"
```

| 变量 | 用途 | 必需 |
|------|------|------|
| `GITLAB_TOKEN` | GitLab API 调用 | 是（MR/GitLab 相关） |
| `JIRA_USERNAME` | Jira REST API basic auth | 是（Linux 获取 Jira） |
| `JIRA_PASSWORD` | Jira REST API basic auth | 是（Linux 获取 Jira） |
| `JIRA_API_TOKEN` | Jira API token（优先于密码） | 否 |

> **注意**：脚本启动时自动 `source` 上述 `.env` 文件，无需手动 export。

---

## 平台支持矩阵

| 平台 | Jira | GitLab MR | 通用内网页面 |
|------|------|-----------|-------------|
| **Linux** | ✅ REST API + basic auth | ✅ GitLab API | ⚠️ curl（公开页）/ 手动提供（登录页） |
| **macOS** | ✅ AppleScript + Chrome | ✅ GitLab API | ✅ AppleScript + Chrome |
| **Windows** | ❌ 未实现 | ❌ 未实现 | ❌ 未实现 |

---

## 公共基础设施

### URL 解析与路由

入口脚本根据 URL 特征自动判断信息源类型：

```bash
URL="https://jira.qima-inc.com/browse/CSWT-191480"

if echo "$URL" | grep -qE 'jira\..*/browse/'; then
    TYPE="jira"
elif echo "$URL" | grep -qE 'gitlab\..*/-/merge_requests/'; then
    TYPE="gitlab-mr-bg"
elif echo "$URL" | grep -qE 'gitlab\..*/-/wikis/'; then
    TYPE="gitlab-wiki"
elif echo "$URL" | grep -qE 'qima-inc'; then
    TYPE="intranet"
else
    echo "Non-intranet URL, skipping briar-context."
    exit 0
fi
```

### Linux: Jira REST API

```bash
# 自动从 ~/.config/briar-skills/.env 读取凭证
curl -s -u "$JIRA_USERNAME:$JIRA_PASSWORD" \
  "https://jira.qima-inc.com/rest/api/2/issue/CSWT-191480" | jq .
```

返回字段：
- `.key` — ticket ID
- `.fields.summary` — 标题
- `.fields.description` — 描述（HTML，需去标签）
- `.fields.status.name` — 状态
- `.fields.priority.name` — 优先级
- `.fields.assignee.displayName` — 经办人
- `.fields.reporter.displayName` — 报告人

### macOS: AppleScript + Chrome

**前置要求**：
- Chrome 已安装（`/Applications/Google Chrome.app`）
- Chrome 已开启**"允许 Apple 事件中的 JavaScript"**

**开启方式**：菜单栏 → **查看 → 开发者 → 允许 Apple 事件中的 JavaScript**

**获取脚本**（智能提取主内容区 + 轮询加载 + 自动关闭）：
```applescript
tell application "Google Chrome"
    activate
    tell front window
        set newTab to make new tab at end of tabs
        set URL of newTab to "TARGET_URL"
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
```

---

## 注意事项

1. **AppleScript 会实际打开 Chrome 标签页**，获取完成后**自动关闭**
2. **SPA 等待**：单页应用（Jira、GitLab 等）在 `document.readyState === 'complete'` 后仍需固定等待 **3 秒**
3. **Linux 登录态**：Linux 服务器无法复用浏览器 cookie，Jira 必须通过 REST API + basic auth 获取
4. **Cookie 安全**：通过 AppleScript 获取的 cookie 是内存中的实时值，不要持久化到日志或文件

---

## 总入口脚本

```bash
./packages/briar-skills/briar-context/scripts/briar-context.sh <url>
```

脚本自动判断 URL 类型，选择最佳获取方式，输出结构化上下文。
