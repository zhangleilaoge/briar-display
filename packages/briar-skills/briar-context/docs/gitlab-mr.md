# 获取 GitLab MR 背景信息

**触发条件**：用户在 review/fix MR 前，要求"获取这个 MR 的关联需求/背景信息"。

> ⚠️ **边界说明**：本行为仅获取 MR 的**元信息**（标题、描述、关联 Jira），作为下游 `briar-mr` 的前置输入。MR 本身的评论、review、pipeline 等业务操作由 `briar-mr` 处理。用户只说"MR 链接"而没有明确意图时，不归本 skill 处理。

---

## 前置要求

需要 `GITLAB_TOKEN`，读取优先级：
1. 环境变量 `GITLAB_TOKEN`
2. `~/.config/briar-skills/.env`
3. 当前 git 仓库根目录的 `.env`（向后兼容），或通过 `BRIAR_PROJECT_ENV` 显式指定

```bash
# 脚本启动时自动加载，无需手动设置
# load_env() 会自动 source 上述 .env 文件
```

---

## 获取流程

### 1. 解析 URL

```
https://gitlab.qima-inc.com/wsc-node/wsc-pc-channel/-/merge_requests/936
              ↑domain↑     ↑project_path↑                      ↑iid↑
```

```bash
URL="https://gitlab.qima-inc.com/wsc-node/wsc-pc-channel/-/merge_requests/936"
DOMAIN=$(echo "$URL" | sed -E 's|https?://([^/]+)/.*|\1|')
PROJECT_PATH=$(echo "$URL" | sed -E 's|https?://[^/]+/([^/]+/[^/]+)/-/merge_requests/.*|\1|')
MR_IID=$(echo "$URL" | sed -E 's|.*/-/merge_requests/([0-9]+).*|\1|')
ENCODED_PATH=$(echo "$PROJECT_PATH" | sed 's/\//%2F/g')
```

### 2. 调用 GitLab API

```bash
curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "https://$DOMAIN/api/v4/projects/$ENCODED_PATH/merge_requests/$MR_IID"
```

### 3. 获取变更概览（可选）

```bash
curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "https://$DOMAIN/api/v4/projects/$ENCODED_PATH/merge_requests/$MR_IID/changes" | \
  jq -r '.changes[] | "\(.new_path): +\(.additions)/-\(.deletions)"' 2>/dev/null | head -20
```

### 4. 自动发现关联 Jira

从 MR 描述中提取 Jira ticket ID（正则匹配 `[A-Z]+-[0-9]+`），如果命中，自动递归调用 `briar-context` 抓取 Jira 内容：

```bash
JIRA_TICKET=$(echo "$DESC" | grep -oE '[A-Z]+-[0-9]+' | head -1)
if [ -n "$JIRA_TICKET" ]; then
    JIRA_URL="https://jira.qima-inc.com/browse/$JIRA_TICKET"
    ./briar-context.sh "$JIRA_URL"
fi
```

---

## 结构化输出

```
【MR 背景】!936
- 标题: xxx
- 来源分支: feat/xxx → 目标分支: feat/yyy
- 状态: opened / merged / closed
- 描述: xxx
- 变更文件:
  src/foo.ts: +15/-3
  src/bar.ts: +42/-0
- 关联 Jira: CSWT-191480
  【Jira 上下文】CSWT-191480
  - 标题: xxx
  ...
```

---

## 无 Token 时的处理

如果没有 `GITLAB_TOKEN`，脚本会报错并提示：

```
[briar-context] No GITLAB_TOKEN found.
  Set it in ~/.config/briar-skills/.env or the current git repository's .env (or via BRIAR_PROJECT_ENV)
```

请确保 `.env` 文件已正确配置并设置权限 `chmod 600`。
