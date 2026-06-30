---
name: briar-context
description: 获取 Jira/GitLab/内网页面内容，为 briar-mr、briar-fix 提供上下文。MR 链接无明确意图时归 briar-mr 处理。
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

|| 行为 | 触发关键词 | 文档 | 工具 |
||------|-----------|------|------|
|| 获取 Jira 内容 | "看看这个需求"、"获取 Jira"、Jira 链接 | [docs/jira.md](docs/jira.md) | Linux: REST API + basic auth / macOS: Playwright + Chrome cookie |
|| 获取 MR 背景信息 | "获取 MR 的关联需求"、"MR 背景" | [docs/gitlab-mr.md](docs/gitlab-mr.md) | GitLab API |
|| 获取内网页面 | "获取内容"、"看看这个页面"、内网链接（含 `qima-inc`） | [docs/generic.md](docs/generic.md) | Playwright + Chrome cookie → 密码 fallback |
|| 汇总上下文 | "整理上下文"、"汇总信息"、多个链接 | — | 多次调用上述能力后汇总 |

---

## 凭证配置

所有 briar skill 共用同一套 `.env` 加载机制：

1. **全局配置**（推荐）：`~/.config/briar-skills/.env`
2. **项目内配置**（向后兼容）：当前 git 仓库根目录的 `.env`，或通过环境变量 `BRIAR_PROJECT_ENV` 显式指定

**初始化**：
```bash
mkdir -p "$HOME/.config/briar-skills"
cat > "$HOME/.config/briar-skills/.env" << 'EOF'
GITLAB_TOKEN="your_gitlab_token"
JIRA_USERNAME="your_username_or_email"
JIRA_PASSWORD="your_password"
EOF
chmod 600 "$HOME/.config/briar-skills/.env"
```

| 变量 | 用途 | 必需 |
|------|------|------|
| `GITLAB_TOKEN` | GitLab API 调用 | 是（MR/GitLab 相关） |
| `JIRA_USERNAME` | Jira REST API basic auth / 表单登录 fallback | 否（macOS 优先用 Chrome cookie） |
| `JIRA_PASSWORD` | Jira REST API basic auth / 表单登录 fallback | 否（macOS 优先用 Chrome cookie） |
| `JIRA_API_TOKEN` | Jira API token（优先于密码） | 否 |

> **注意**：脚本启动时自动 `source` 上述 `.env` 文件，无需手动 export。
> **macOS 登录态**：优先从 Chrome 读取 `.qima-inc.com` 域 cookie，通过 Playwright 无头浏览器访问页面；仅当 cookie 失效时才使用 `JIRA_USERNAME`/`JIRA_PASSWORD` 表单登录。

---

## 平台支持矩阵

| 平台 | Jira | GitLab MR | 通用内网页面 |
|------|------|-----------|-------------|
| **Linux** | ✅ REST API + basic auth | ✅ GitLab API | ⚠️ curl（公开页）/ 手动提供（登录页） |
| **macOS** | ✅ Playwright + Chrome cookie → 密码 fallback | ✅ GitLab API | ✅ Playwright + Chrome cookie → 密码 fallback |
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

### macOS: Playwright + Chrome cookie

**前置要求**：
- Python 3 环境 + `playwright`、`browser-cookie3` 已安装
- Chrome 已登录过 `.qima-inc.com` 域（如 Jira、GitLab、OPS），cookie 可用
- `opscli login` 已执行（可刷新 OPS 统一登录态）

**流程**：
1. 用 `browser-cookie3` 从 Chrome 读取 `.qima-inc.com` 域 cookie
2. 用 Playwright 启动无头 Chromium
3. 注入 cookie 后访问目标页面
4. 如果仍被重定向到登录页，尝试用 `JIRA_USERNAME`/`JIRA_PASSWORD` 表单登录
5. 提取主内容区文本返回

**脚本入口**：`scripts/fetch_with_playwright.py`

### macOS: AppleScript + Chrome（最终 fallback）

当 Playwright 方案完全失败时使用。
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

1. **macOS 优先使用 Playwright 无头浏览器**，不会实际打开 Chrome 窗口
2. **SPA 等待**：单页应用（Jira、GitLab 等）等待 `networkidle` 状态
3. **Linux 登录态**：Linux 服务器无法复用浏览器 cookie，Jira 必须通过 REST API + basic auth 获取
4. **Cookie 安全**：从 Chrome 读取的 cookie 仅用于内存中访问页面，不要持久化到日志或文件
5. **依赖安装**：首次使用 macOS 方案前需确保 `playwright` 和 `browser-cookie3` 已安装到当前 Python 环境
6. **AppleScript fallback**：仅当 Playwright 和 cookie 都失败时才启用，会实际打开 Chrome 标签页并自动关闭

---

## 总入口脚本

```bash
./scripts/briar-context.sh <url>
# 或在 PATH 中直接使用
briar-context.sh <url>
```

脚本自动判断 URL 类型，选择最佳获取方式，输出结构化上下文。
