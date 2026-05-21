# 评论全链路（fetch / comment / reply / review / fix）

所有围绕"MR 评论"的操作。用户意图通常是"我要处理这个 MR 的 review"。

---

## 一、获取评论（fetch）

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

或通过脚本：

```bash
./packages/briar-skills/briar-mr/scripts/briar-mr-review.sh fetch <domain> <project_path> <mr_iid>
# 或
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

## 二、发表评论（comment）

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

或通过脚本：

```bash
./packages/briar-skills/briar-mr/scripts/briar-mr-review.sh comment <domain> <project_path> <mr_iid> "评论内容"
# 或
./packages/briar-skills/briar-mr/scripts/briar-mr.sh comment <domain> <project_path> <mr_iid> "评论内容"
```

### 注意

- 需要 `api` scope（不仅仅是 `read_api`）
- 如果用户没有提供评论内容，询问用户想说什么
- 发表成功后返回评论 ID 和链接

---

## 三、回复 Discussion（reply）

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

或通过脚本：

```bash
./packages/briar-skills/briar-mr/scripts/briar-mr-review.sh reply <domain> <project_path> <mr_iid> <discussion_id> "回复内容"
# 或
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

## 四、Review 代码（review）

**触发条件**：用户说"review 这个 MR"、"帮我看看代码"、"code review"、"审查一下代码"。

### 流程

1. **准备仓库与完整 diff（推荐）**

   > ⚠️ **不要只基于 API 返回的局部 diff 做 review**。MR 中的 diff 往往缺少上下文（如被修改函数的完整逻辑、相关依赖文件），容易误判。

   **推荐做法**：先把仓库拉到本地，看完整的 `target..source` diff：

   ```bash
   # 从 project_path 推断仓库名（如 wsc-node/wsc-pc-channel → wsc-pc-channel）
   REPO_NAME=$(echo "$PROJECT_PATH" | sed 's/.*\///')
   LOCAL_REPO="/Users/zhanglei/Documents/projects/$REPO_NAME"

   # 1. 检查本地是否已有该仓库
   if [ ! -d "$LOCAL_REPO/.git" ]; then
       # 没有则拉取（复用 briar-repo）
       ./packages/briar-skills/briar-repo/scripts/briar-repo.sh pull "$REPO_NAME"
   fi

   # 2. 获取 MR 的 source_branch 和 target_branch
   MR_INFO=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
     "https://$DOMAIN/api/v4/projects/$ENCODED_PATH/merge_requests/$MR_IID")
   SOURCE_BRANCH=$(echo "$MR_INFO" | jq -r '.source_branch')
   TARGET_BRANCH=$(echo "$MR_INFO" | jq -r '.target_branch')

   # 3. 在本地查看完整 diff
   cd "$LOCAL_REPO"
   git fetch origin "$SOURCE_BRANCH" "$TARGET_BRANCH"
   git diff "origin/$TARGET_BRANCH..origin/$SOURCE_BRANCH"
   ```

   **API diff 作为 fallback**：如果本地无法获取（仓库太大、网络问题等），再用 API：
   ```bash
   ./packages/briar-skills/briar-mr/scripts/briar-mr-review.sh diff <domain> <project_path> <mr_iid>
   # 或
   ./packages/briar-skills/briar-mr/scripts/briar-mr.sh diff <domain> <project_path> <mr_iid>
   ```

   同时用 API 获取 `diff_refs`（后续添加行级评论时需要）：
   ```bash
   curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
     "https://$DOMAIN/api/v4/projects/$ENCODED_PATH/merge_requests/$MR_IID" | jq '.diff_refs'
   ```

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

   **评论必须定位到具体代码行**。不要只发一条顶层总结评论，应将每条 review 意见通过 DiffNote 精准挂载到对应的代码行上，让 reviewer 能在 MR diff 页面直接看到问题和修改建议。

4. **主动询问**

   Review 结束后**必须主动询问**：
   > "以上是我的 review 意见。是否需要我将这些意见作为行级评论添加到 MR 中？"

   如果用户同意，使用下方 DiffNote API 逐条添加；如果用户说"直接评论"或"发上去"，也默认使用 DiffNote 定位到行，可额外附带一条顶层总结 Note。

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
- **评论应优先使用 DiffNote（行级评论）**，精确定位到新增/修改的代码行，确保 reviewer 能在 MR diff 页面直接看到。只有在用户明确只需要总结时才只发顶层 Note

---

## 五、修复评论（fix）

**触发条件**：用户说"按评论修复"、"处理 code review"、"修掉问题"、"分析并修复"。

> **代码修复由 briar-fix 处理**。本章节只描述判断标准和决策逻辑，实际修复操作见 [briar-fix 文档](../../briar-fix/SKILL.md)。

### 行为依赖

```
获取评论（fetch） ← 修复评论（fix） → 回复 Discussion（reply，可选）
```

- **修复评论**内部需要先**获取评论**（同 fetch），分析后再修复。
- **代码修复阶段**调用 `briar-fix`：创建 worktree → 读取 comments + diff 上下文 → 修复 → 验证 → 用户确认 → 提交 → 清理 worktree。
- **回复 Discussion**不是修复评论的子步骤，而是一个**可选的后续独立行为**。用户可能只修复不回复，也可能修复后要求逐条回复。
- 不要自动执行回复 Discussion，必须等用户明确要求后再触发。

### 工作流程

```
获取评论（fetch）
  ↓
逐条分析合理性
  ↓
调用 briar-fix 修复代码
  │   1. setup worktree（基于 MR source_branch）
  │   2. 读取 comments + diff 上下文
  │   3. 修复代码
  │   4. verify（typecheck / lint）
  │   5. 展示 diff，等用户确认
  │   6. commit + push
  │   7. cleanup worktree
  ↓
输出修复总结表格
```

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

### 修复脚本速查

```bash
# 创建 worktree
./packages/briar-skills/briar-fix/scripts/briar-fix.sh setup \
  /Users/zhanglei/Documents/projects/<repo> <branch> fix-<mr_iid>

# 验证
./packages/briar-skills/briar-fix/scripts/briar-fix.sh verify <worktree_path>

# 展示 diff 等用户确认
./packages/briar-skills/briar-fix/scripts/briar-fix.sh diff <worktree_path>

# 用户确认后提交
./packages/briar-skills/briar-fix/scripts/briar-fix.sh commit <worktree_path> "fix: 按 review 修复"
./packages/briar-skills/briar-fix/scripts/briar-fix.sh push <worktree_path>

# 清理
./packages/briar-skills/briar-fix/scripts/briar-fix.sh cleanup <repo_path> <worktree_path>
```

### 输出总结

| # | 评论摘要 | 是否合理 | 状态 | 原因 |
|---|---------|---------|------|------|
| 1 | 移除 `parentComponent: this` | ✅ | 已修复 | - |
| 2 | `channelId` 语义不一致 | ✅ | 已修复 | - |
| 3 | 静默过滤建议加错误提示 | ❌ | 跳过 | 异常场景极少，属防御性建议 |
