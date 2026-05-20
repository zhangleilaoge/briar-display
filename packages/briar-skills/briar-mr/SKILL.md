---
name: briar-mr
description: >
  GitLab Merge Request（MR）全能工具：创建 MR、获取评论、发表评论、回复 Discussion、获取 Pipeline、Review 代码、按评论修复代码。
  触发场景：
  1. 用户说"提个 MR"、"创建 MR"、"提交合并请求" → 触发【创建 MR】（自动推导标题和内容）
  2. 用户给出 GitLab MR 链接，要求"看看评论"、"获取评论"、"列出评论" → 触发【获取评论】
  3. 用户要求在 MR 中"发表评论"、"加一条评论" → 触发【发表评论】
  4. 用户要求"回复这些评论"、"逐条回复"、"给评论写回复" → 触发【回复 Discussion】
  5. 用户说"看看 pipeline"、"CI 状态"、"构建结果" → 触发【获取 Pipeline】
  6. 用户说"review 这个 MR"、"帮我看看代码"、"code review" → 触发【Review 代码】
  7. 用户要求"按评论修复代码"、"处理 code review"、"修掉评论里的问题" → 触发【修复评论】
  本 skill 不会默认执行全部能力，严格根据用户意图触发对应行为。
---

# briar-mr: GitLab MR 全能工具

## Token 管理

### 检查 Token

读取 skill 目录下的 `.env` 文件：

```bash
ENV_FILE="/Users/zhanglei/Documents/projects/briar-display/packages/briar-skills/.env"
if [ -f "$ENV_FILE" ]; then
  export GITLAB_TOKEN=$(grep GITLAB_TOKEN "$ENV_FILE" | cut -d= -f2-)
fi
```

### 索要 Token

如果 `.env` 中不存在 `GITLAB_TOKEN`，**必须主动向用户索要**：

> "我需要 GitLab Access Token 才能操作 MR。请提供一个有 `read_api` + `api` 权限的 token（`api` 权限用于创建 MR 和发表评论，`read_api` 用于获取评论）。我会将其保存在本地 `.env` 文件中，不会提交到 Git。"

### 存储 Token

拿到 token 后写入 `.env`：

```bash
mkdir -p /Users/zhanglei/Documents/projects/briar-display/packages/briar-skills
echo "GITLAB_TOKEN=YOUR_TOKEN" > "$ENV_FILE"
chmod 600 "$ENV_FILE"
```

---

## 行为一：创建 MR（create）

**触发条件**：用户说"提个 MR"、"创建 MR"、"提交合并请求"、"发一个 MR"。

**核心能力**：自动推导 MR 标题和内容，无需用户手动填写。

### 前置要求

- 必须知道**仓库本地路径**（从用户提供的文件路径或当前工作目录推断）
- 必须知道**源分支**（source_branch）和**目标分支**（target_branch，默认 `master`）
- 必须有未合并到目标分支的 commit

### 自动推导逻辑

在仓库本地执行以下命令收集信息：

```bash
cd <repo_path>

# 1. 获取 commit 列表（subject + body）
COMMITS=$(git log --format="%H %s" <target>..<source>)
COMMIT_COUNT=$(echo "$COMMITS" | wc -l | tr -d ' ')

# 2. 获取 diff 统计
DIFF_STAT=$(git diff --stat <target>..<source>)

# 3. 获取变更文件列表
FILES_CHANGED=$(git diff --name-only <target>..<source>)
```

#### 标题推导规则

| commit 数量 | 标题来源 | 示例 |
|------------|---------|------|
| 1 | 直接使用该 commit 的 subject | `refactor(omni-channel): 优化抖音相关授权及列表逻辑` |
| ≥2 | 取**第一个 commit 的 subject**；如果是 WIP/fixup，取第二个或分支名推断 | `feat: 多渠道授权功能合集` |

> 如果分支名符合 `feat/xxx`、`fix/xxx`、`hotfix/xxx` 且 commit subject 没有前缀，可给标题加上对应前缀（如 `feat:`、`fix:`）。

#### 内容推导规则

按以下模板组装 Markdown：

```markdown
## 变更摘要

{{ 如果有多个 commit，列出所有 commit subject；如果只有一个 commit，略过此节或只写 "本次变更包含 1 个 commit。" }}

## 变更文件

```
{{ git diff --stat 输出 }}
```

## 详细说明

{{ 第一个 commit 的 body（如果有）}}
```

### 执行创建

推导完成后调用脚本：

```bash
./packages/briar-skills/briar-mr/scripts/briar-mr.sh create \
  <domain> <project_path> <source_branch> <target_branch> "<title>" "<description>"
```

### 输出与反馈

创建成功后**必须将 MR 链接展示给用户**：

```
✅ MR created成功！
   链接：https://gitlab.qima-inc.com/wsc-node/wsc-pc-channel/-/merge_requests/1234
```

> 不要只返回 IID 或只写"创建成功"，用户需要直接点击链接查看 MR。

---

## 行为二：获取评论（fetch）

**触发条件**：用户说"看看 MR 评论"、"获取评论"、"列出评论"、"MR 有什么评论"、只给了 MR 链接没说要干什么。

**只做一件事**：获取 MR 的所有评论和讨论，整理成清晰的列表展示给用户，**不做任何修复**。

### API

```bash
export GITLAB_TOKEN=$(grep GITLAB_TOKEN /Users/zhanglei/Documents/projects/briar-display/packages/briar-skills/.env | cut -d= -f2-)
ENCODED_PATH=$(echo "$PROJECT_PATH" | sed 's/\//%2F/g')

# Notes（普通评论）
curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "https://$DOMAIN/api/v4/projects/$ENCODED_PATH/merge_requests/$MR_IID/notes?per_page=100"

# Discussions（行级讨论/DiffNote）
curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "https://$DOMAIN/api/v4/projects/$ENCODED_PATH/merge_requests/$MR_IID/discussions?per_page=100"
```

或直接用脚本：
```bash
./packages/briar-skills/briar-mr/scripts/briar-mr.sh fetch <domain> <project_path> <mr_iid>
```

### 输出格式

整理成表格展示：

| # | 类型 | 作者 | 状态 | 内容摘要 |
|---|------|------|------|---------|
| 1 | DiffNote | iDev | 未解决 | `channelId` 应为 `DY_LEAD` |
| 2 | DiscussionNote | iDev | 未解决 | `hasDuplicate` 可简化 |

DiffNote 额外标注：文件路径 + 行号。

---

## 行为三：发表评论（comment）

**触发条件**：用户说"在 MR 里加条评论"、"发表一下意见"。

**只做一件事**：在 MR 中**发表一条全新的顶层评论**，**不获取、不修复、不回复已有 discussion**。

### API

```bash
# 注意：此 API 发表的是 MR 的顶层 Note，不会关联到任何 Discussion/DiffNote
curl -s -X POST \
  --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{"body":"评论内容"}' \
  "https://$DOMAIN/api/v4/projects/$ENCODED_PATH/merge_requests/$MR_IID/notes"
```

或直接用脚本：
```bash
./packages/briar-skills/briar-mr/scripts/briar-mr.sh comment <domain> <project_path> <mr_iid> "评论内容"
```

### 注意

- 需要 `api` scope（不仅仅是 `read_api`）
- 如果用户没有提供评论内容，询问用户想说什么
- 发表成功后返回评论 ID 和链接

---

## 行为四：回复 Discussion（reply）

**触发条件**：用户要求"回复这些评论"、"逐条回复"、"给评论写回复"。

> 此行为可**独立执行**，也可在「修复评论」后由用户要求执行。不需要必须先修复才能回复——用户可能只想对已有评论写回复而不修改代码。

**只做一件事**：在已有的 Discussion（包括 DiffNote 和 DiscussionNote）下追加回复。

> **重要区别**：DiffNote 和 DiscussionNote 都属于 Discussion，**必须在 discussion 下回复**，用 `/notes` API 发表的新评论不会出现在原 discussion 的线程中，reviewer 看不到。

### API

```bash
# 在指定 discussion 下追加回复
# discussion_id 从 fetch discussions 的返回中获取（字段名为 id）
curl -s -X POST \
  --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{"body":"回复内容"}' \
  "https://$DOMAIN/api/v4/projects/$ENCODED_PATH/merge_requests/$MR_IID/discussions/$DISCUSSION_ID/notes"
```

或直接用脚本：
```bash
./packages/briar-skills/briar-mr/scripts/briar-mr.sh reply <domain> <project_path> <mr_iid> <discussion_id> "回复内容"
```

### ⚠️ Shell JSON 引号坑（必看）

回复内容中经常包含反引号 `` ` ``、双引号 `"`、单引号 `'`（如代码片段 `alt=""`），直接在 `--data` 中拼接 JSON 会导致 bash 解析失败。

**推荐方案 A：用 `jq` 构造 JSON（最稳）**
```bash
BODY="已修复，将 \`alt=\"\"\` 改为 \`alt={item.content || ''}\` ✅"
JSON_PAYLOAD=$(jq -n --arg body "$BODY" '{body: $body}')
curl -s -X POST \
  --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  --header "Content-Type: application/json" \
  --data "$JSON_PAYLOAD" \
  "https://$DOMAIN/api/v4/projects/$ENCODED_PATH/merge_requests/$MR_IID/discussions/$DISCUSSION_ID/notes"
```

**推荐方案 B：写临时文件**
```bash
cat > /tmp/reply.json << 'EOF'
{"body":"已修复，将 `alt=\"\"` 改为 `alt={item.content || ''}` ✅"}
EOF
curl -s -X POST \
  --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  --header "Content-Type: application/json" \
  --data @/tmp/reply.json \
  "https://$DOMAIN/api/v4/projects/$ENCODED_PATH/merge_requests/$MR_IID/discussions/$DISCUSSION_ID/notes"
```

### 回复内容模板

| 场景 | 模板 |
|------|------|
| 已修复 | `已修复，将 xxx 改为 yyy ✅` 或 `已修复，移除了未使用的 zzz ✅` |
| 跳过（防御性建议） | `该建议属于防御性优化，当前异常场景极少，增加处理逻辑会增加代码复杂度且收益有限，建议保持现状。⏸️` |
| 跳过（业务待确认） | `该 TODO/设计涉及业务进度，需产品/后端确认 xxx 是否已就绪后才能处理。当前保留可避免遗漏，建议合入前与相关同学确认。⏸️` |
| 跳过（无法确认 DOM/结构） | `该建议取决于页面实际 xxx 方式，当前代码在 yyy 场景下有效。当前无法从代码层面 100% 确认，贸然修改可能导致 zzz 失效。如后续确认存在问题可针对性调整。⏸️` |

### 标记 Discussion 为已解决（resolved）

对于已修复且回复过的 discussion，可以标记为 resolved（可选，取决于团队习惯）：

```bash
curl -s -X PUT \
  --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{"resolved": true}' \
  "https://$DOMAIN/api/v4/projects/$ENCODED_PATH/merge_requests/$MR_IID/discussions/$DISCUSSION_ID"
```

---

## 行为五：获取 Pipeline（pipeline）

**触发条件**：用户说"看看 pipeline"、"CI 怎么样"、"构建状态"、"检查构建结果"。

**只做一件事**：获取 MR 关联的 Pipeline 信息和各 Job 的执行状态。

### API

```bash
export GITLAB_TOKEN=$(grep GITLAB_TOKEN /Users/zhanglei/Documents/projects/briar-display/packages/briar-skills/.env | cut -d= -f2-)
ENCODED_PATH=$(echo "$PROJECT_PATH" | sed 's/\//%2F/g')

# 获取 MR 详情中的 head_pipeline
curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "https://$DOMAIN/api/v4/projects/$ENCODED_PATH/merge_requests/$MR_IID" | jq '.head_pipeline'

# 获取 Pipeline 的 Jobs
curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "https://$DOMAIN/api/v4/projects/$ENCODED_PATH/pipelines/$PIPELINE_ID/jobs"
```

或直接用脚本：
```bash
./packages/briar-skills/briar-mr/scripts/briar-mr.sh pipeline <domain> <project_path> <mr_iid>
```

### 输出格式

整理成清晰的表格展示：

| Job 名称 | Stage | 状态 | 耗时 | 失败原因 |
|---------|-------|------|------|---------|
| lint | lint | ❌ failed | 283s | - |
| test | test | ✅ passed | 45s | - |
| build | build | ⏳ running | - | - |

同时展示 Pipeline 总体信息：状态、耗时、链接。

---

## 行为六：Review 代码（review）

**触发条件**：用户说"review 这个 MR"、"帮我看看代码"、"code review"、"审查一下代码"。

### 流程

1. **获取 MR diff**

   ```bash
   ./packages/briar-skills/briar-mr/scripts/briar-mr.sh diff <domain> <project_path> <mr_iid>
   ```

   或直接用 API：
   ```bash
   curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
     "https://$DOMAIN/api/v4/projects/$ENCODED_PATH/merge_requests/$MR_IID/changes"
   ```

   返回的 JSON 中：
   - `changes[].diff`：文件 diff 内容（unified diff 格式）
   - `changes[].new_path`：文件路径
   - `diff_refs`：`base_sha`、`head_sha`、`start_sha`（用于后续添加行级评论）

2. **分析 diff**

   对变更代码进行 review，关注：
   - 语法/类型问题
   - 语义一致性（变量命名、常量值等）
   - 代码简化机会
   - 异常处理是否完善
   - 性能隐患
   - 可读性与可维护性

3. **输出 review 结果**

   按文件组织，每条意见包含：
   - 🔴 **严重**：明显 bug、类型错误、会导致运行时异常
   - 🟡 **建议**：可优化、可简化、命名不规范
   - 🟢 **优点**：设计合理、写法简洁、值得保留

4. **主动询问**

   Review 结束后**必须主动询问**：
   > "以上是我的 review 意见。是否需要我将这些意见作为行级评论添加到 MR 中？"

### 添加行级评论（DiffNote）

如果用户同意，使用 Discussion API 在对应位置添加评论：

```bash
# 先获取 diff_refs
DIFF_REFS=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "https://$DOMAIN/api/v4/projects/$ENCODED_PATH/merge_requests/$MR_IID" | jq '.diff_refs')
BASE_SHA=$(echo "$DIFF_REFS" | jq -r '.base_sha')
HEAD_SHA=$(echo "$DIFF_REFS" | jq -r '.head_sha')
START_SHA=$(echo "$DIFF_REFS" | jq -r '.start_sha')

# 添加 DiffNote
JSON_PAYLOAD=$(jq -n \
  --arg body "review 评论内容" \
  --arg base_sha "$BASE_SHA" \
  --arg head_sha "$HEAD_SHA" \
  --arg start_sha "$START_SHA" \
  --arg new_path "文件路径.ts" \
  --argjson new_line 10 \
  '{
    body: $body,
    position: {
      base_sha: $base_sha,
      head_sha: $head_sha,
      start_sha: $start_sha,
      position_type: "text",
      new_path: $new_path,
      new_line: $new_line
    }
  }')

curl -s -X POST \
  --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  --header "Content-Type: application/json" \
  --data "$JSON_PAYLOAD" \
  "https://$DOMAIN/api/v4/projects/$ENCODED_PATH/merge_requests/$MR_IID/discussions"
```

### 注意

- 如果 diff 文件过多（>5 个）或单文件 diff 过长（>200 行），先展示文件列表和统计，询问用户重点关注哪些文件
- 添加评论前**必须获得用户明确同意**，不要自动发表
- 添加评论时精确定位到行号，确保 reviewer 能在 MR 页面直接看到

---

## 行为七：修复评论（fix）

**触发条件**：用户说"按评论修复"、"处理 code review"、"修掉问题"、"分析并修复"。

### 行为依赖

```
获取评论（行为二） ← 修复评论（行为七） → 回复 Discussion（行为四，可选）
```

- **修复评论**内部需要先**获取评论**（同行为二），分析后再修复。
- **回复 Discussion**不是修复评论的子步骤，而是一个**可选的后续独立行为**。用户可能只修复不回复，也可能修复后要求逐条回复。
- 不要自动执行回复 Discussion，必须等用户明确要求后再触发。

### 工作流程

**获取评论** → 逐条分析合理性 → 执行修复（合理的）/ 跳过并说明原因（不合理的） → TypeScript 编译检查 → 输出总结表格

### 评论判断标准

| 评论类型 | 判断标准 | 操作 |
|---------|---------|------|
| 语法/类型错误 | 明显错误，如 `this` 在函数组件中为 `undefined` | ✅ 修复 |
| 语义不一致 | 变量名、常量值与业务语义不符 | ✅ 修复 |
| 代码简化 | 可用更简洁写法，不影响逻辑 | ✅ 修复 |
| 重复代码 | 多处相同逻辑，可提取公共方法 | ✅ 修复 |
| 异常处理 | 批量操作部分失败的处理 | ✅ 视业务判断 |
| 防御性建议 | 增加错误提示、日志，异常场景极少 | ❌ 跳过（说明原因） |
| 设计争议 | 涉及架构决策，无明确对错 | ❌ 跳过（说明原因） |

### 验证

```bash
npx tsc --noEmit
# 或项目特定的 typecheck 命令
```

### 输出总结

| # | 评论摘要 | 是否合理 | 状态 | 原因 |
|---|---------|---------|------|------|
| 1 | 移除 `parentComponent: this` | ✅ | 已修复 | - |
| 2 | `channelId` 语义不一致 | ✅ | 已修复 | - |
| 3 | 静默过滤建议加错误提示 | ❌ | 跳过 | 异常场景极少，属防御性建议 |

---

## 解析 MR URL

从用户提供的 URL 提取信息：

```
https://gitlab.qima-inc.com/wsc-node/wsc-pc-channel/-/merge_requests/932
              ↑domain↑     ↑project_path↑                      ↑iid↑
```

- `DOMAIN`: `gitlab.qima-inc.com`（或其他 GitLab 实例）
- `PROJECT_PATH`: `wsc-node/wsc-pc-channel`
- `MR_IID`: `932`

`project_path` 需要 URL 编码：`/` → `%2F`

---

## 七种行为速查

| 行为 | 触发关键词 | 所需权限 | 自动执行？ |
|------|-----------|---------|-----------|
| 创建 MR | "提个 MR"、"创建 MR"、"提交合并请求" | `api` | 是（自动推导标题内容） |
| 获取评论 | "看看评论"、"获取评论"、"列出" | `read_api` | 是 |
| 发表评论 | "发表评论"、"加条评论" | `api` | 需确认内容 |
| 回复 Discussion | "回复这些评论"、"逐条回复"、"给评论写回复" | `api` | 需确认内容 |
| 获取 Pipeline | "看看 pipeline"、"CI 状态"、"构建结果" | `read_api` | 是 |
| Review 代码 | "review"、"看看代码"、"code review"、"审查代码" | `read_api` | 是（分析后询问是否添加评论） |
| 修复评论 | "修复"、"处理 review"、"修掉" | `read_api` | 是（分析后） |

**重要**：用户只说"MR 链接"而没有明确意图时，默认触发【获取评论】，**不要自动修复**；修复后不要自动回复 Discussion，需等用户明确要求。
