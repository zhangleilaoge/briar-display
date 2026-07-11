# 评论全链路（fetch / comment / reply / review / fix）

所有围绕"MR 评论"的操作。用户意图通常是"我要处理这个 MR 的 review"。

---

## 一、获取评论（fetch）

**触发条件**：用户说"看看 MR 评论"、"获取评论"、"列出评论"、"MR 有什么评论"、只给了 MR 链接没说要干什么。

**只做一件事**：获取 MR 的所有评论和讨论，整理成清晰的列表展示给用户，**不做任何修复**。

### API

```bash
# 读取 GITLAB_TOKEN：优先环境变量 → 全局配置
if [ -z "$GITLAB_TOKEN" ]; then
    ENV_FILE="$HOME/.config/briar-skills/.env"
    if [ -f "$ENV_FILE" ]; then
        export GITLAB_TOKEN=$(grep GITLAB_TOKEN "$ENV_FILE" | cut -d= -f2-)
    fi
fi

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
../scripts/briar-mr-review.sh fetch <domain> <project_path> <mr_iid>
# 或
../scripts/briar-mr.sh fetch <domain> <project_path> <mr_iid>
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
../scripts/briar-mr-review.sh comment <domain> <project_path> <mr_iid> "评论内容"
# 或
../scripts/briar-mr.sh comment <domain> <project_path> <mr_iid> "评论内容"
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
../scripts/briar-mr-review.sh reply <domain> <project_path> <mr_iid> <discussion_id> "回复内容"
# 或
../scripts/briar-mr.sh reply <domain> <project_path> <mr_iid> <discussion_id> "回复内容"
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
REPLY_FILE=$(mktemp)
cat > "$REPLY_FILE" << 'EOF'
{"body":"已修复，将 `alt=\"\"` 改为 `alt={item.content || ''}` ✅"}
EOF
curl -s -X POST \
  --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  --header "Content-Type: application/json" \
  --data @"$REPLY_FILE" \
  "https://$DOMAIN/api/v4/projects/$ENCODED_PATH/merge_requests/$MR_IID/discussions/$DISCUSSION_ID/notes"
rm -f "$REPLY_FILE"
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

1. **（如只有分支名）先反查 MR iid**

   如果用户给的是 Ungoro 等内部 CR 平台链接，或只说了分支名，先用 `find` action 查到 iid：

   ```bash
   ../scripts/briar-mr-review.sh find <domain> <project_path> <source_branch>
   # 输出 iid, title, web_url 等
   ```

   拿到 `iid` 后再继续后续步骤。

2. **获取 diff 并评估复杂度**

   先通过 API 获取 MR 的变更概览，判断是否需要切 worktree：

   ```bash
   ../scripts/briar-mr-review.sh diff <domain> <project_path> <mr_iid>
   # 或
   ../scripts/briar-mr.sh diff <domain> <project_path> <mr_iid>
   ```

   > 注：`diff` 子命令内部调用 GitLab `changes` API（`/merge_requests/:iid/changes`）。如需直接 curl，请使用 `changes` endpoint，部分 GitLab 实例的 `/diffs` 可能返回 404。

   同时获取 `diff_refs`（后续添加行级评论时需要）：
   ```bash
   curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
     "https://$DOMAIN/api/v4/projects/$ENCODED_PATH/merge_requests/$MR_IID" | jq '.diff_refs'
   ```

   **判断是否需要 worktree 的标准**：

   | 情况 | 示例 | 是否需要 worktree |
   |------|------|----------------|
   | 改动极小，逻辑直白 | 改个常量名、加个判断条件、修个 typo | ❌ 不需要，直接看 API diff 即可 |
   | 文件少但涉及跨函数调用 | 修改了 util 函数，需确认调用方 | ⚠️ 建议切，确认影响范围 |
   | 多文件变更 | >3 个文件，或单文件改动 >100 行 | ✅ 需要，diff 片段缺少上下文 |
   | 新增复杂组件/模块 | 新加页面、新加 hook、重构逻辑 | ✅ 需要，要看完整文件结构和依赖 |
   | 删除代码 | 删了方法或配置 | ⚠️ 建议切，确认是否有其他文件依赖 |

   > 核心原则：**AI 自行判断**。如果感觉"这 diff 我一眼就能看明白，不需要额外上下文"，就不切 worktree；如果需要"这个函数被谁调用了？""这个变量在其他文件里用吗？"等疑问，就切 worktree 确认。

2. **（如需要）创建 Review Worktree 查看完整上下文**

   当判断需要完整代码上下文时，调用 `using-git-worktrees` skill 创建隔离的 review worktree。

   创建前先从 MR 获取源分支和目标分支：
   ```bash
   BASE_URL="https://<domain>/api/v4/projects/<encoded_path>/merge_requests/<mr_iid>"
   MR_INFO=$(curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" "$BASE_URL")
   SOURCE_BRANCH=$(echo "$MR_INFO" | jq -r '.source_branch')
   TARGET_BRANCH=$(echo "$MR_INFO" | jq -r '.target_branch')
   ```

   然后调用 `using-git-worktrees` skill，在本地仓库基础上创建基于 `$SOURCE_BRANCH` 的 worktree。

   在 worktree 中查看代码：
   ```bash
   cd "$WORKTREE_PATH"

   # 完整 diff
   git diff "origin/$TARGET_BRANCH..HEAD"

   # 变更文件列表
   git diff --name-only "origin/$TARGET_BRANCH..HEAD"

   # 被修改文件的完整内容
   cat src/components/Foo.tsx

   # target_branch 上的原始内容（对比用）
   git show "origin/$TARGET_BRANCH:src/components/Foo.tsx"
   ```

3. **分析 diff 与代码逻辑**

   对变更代码进行 review，关注：
   - 语法/类型问题
   - 语义一致性（变量命名、常量值等）
   - 代码简化机会
   - 异常处理是否完善
   - 性能隐患
   - 可读性与可维护性

   > **关键**：如果用了 worktree，结合完整文件内容判断，不要只基于 diff 片段下结论。例如：
   > - 某行修改了一个变量名，要确认该变量在其他地方是否也同步修改
   > - 新增了一个函数，要确认调用方是否正确传参
   > - 删除了某段逻辑，要确认是否有其他文件依赖它

4. **输出 review 结果**

   按文件组织，每条意见包含：
   - 🔴 **严重**：明显 bug、类型错误、会导致运行时异常
   - 🟡 **建议**：可优化、可简化、命名不规范
   - 🟢 **优点**：设计合理、写法简洁、值得保留

   **评论必须定位到具体代码行**。不要只发一条顶层总结评论，应将每条 review 意见通过 DiffNote 精准挂载到对应的代码行上，让 reviewer 能在 MR diff 页面直接看到问题和修改建议。

5. **主动询问**

   Review 结束后**必须主动询问**：
   > "以上是我的 review 意见。是否需要我将这些意见作为行级评论添加到 MR 中？"

   如果用户同意，使用下方 DiffNote API 逐条添加；如果用户说"直接评论"或"发上去"，也默认使用 DiffNote 定位到行，可额外附带一条顶层总结 Note。

6. **（如切了 worktree）清理 Worktree**

   如果第 2 步创建了 worktree，review 完成后（无论是否发表了评论）**立即调用 `using-git-worktrees` skill 清理**。

   > 如果用户说"先不清理，我还要看看"，则推迟清理，但**必须提醒**用户后续手动清理。

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

### `new_line` 的取值规则

| 文件类型 | `new_line` 如何确定 |
|---------|-------------------|
| 新增文件（`new_file: true`） | 直接等于该文件中的实际行号 |
| 修改文件 | 等于该文件在**合并后版本**中的行号；如果目标行在 diff 中是新增侧（`+` 开头），直接用文件中的行号即可 |

> 简记：**`new_line` 永远指向「合并后文件」中的行号**。对新增文件没有歧义；对修改文件，只要确认目标行属于本次新增/修改的内容，直接用文件中的行号即可。

#### 如何从 diff 计算 `new_line`（逐 hunk 法）

GitLab `changes` API 返回的 diff 中，每个 hunk 以 `@@ -old_start,old_count +new_start,new_count @@` 开头：

- **`new_start`** = 该 hunk 在**合并后文件**中的起始行号（已包含前面所有 hunks 的行号偏移）
- 从 `new_start` 开始，对 hunk 内每一行**上下文行**（空格开头）和**新增行**（`+` 开头）逐行 +1
- **删除行**（`-` 开头）不占新文件行号，跳过

**示例**：

```
@@ -68,7 +69,13 @@ const getTip = (...) => {
     return '...';
   }
 
-  return `旧文案`;            ← 删除行，不占新文件行号
+  if (x) {                    ← 新文件第 73 行（new_start=69 + 偏移4）
+    return check(...);        ← 新文件第 74 行（目标行）
+      ? 'A'
+      : 'B';
+  }
+
+  return '新文案';             ← 新文件第 79 行
 };
```

上例中 `new_start=69`，目标行 `return check(...)` 是该 hunk 第 6 个有效行（69 → 70 → 71 → 72 → 73 → **74**），所以 `new_line=74`。

#### 不确定行号时

如果 diff 复杂、hunk 多、难以一眼定位准确行号，**建议切 worktree 后用 `cat -n` 确认**：

```bash
cd "$WORKTREE_PATH" && cat -n path/to/file.ts | head -80 | tail -20
```

不要凭猜测填写 `new_line`，400 错误会浪费调用次数。

#### DiffNote 定位失败排查

如果批量添加时返回 `400 Bad request - Note {:line_code=>["can't be blank", "must be a valid line code"]}`，常见原因：

| 原因 | 说明 | 解决方法 |
|------|------|---------|
| 行号指向上下文行 | `new_line` 必须是本次新增/修改的行，不能是未变更的上下文行 | 换到 `+` 开头的行或修改后的行 |
| 行号超出 diff hunk | 目标行不在 GitLab 返回的 diff hunk 范围内 | 先用 `changes` API 确认 diff 中是否包含该行 |
| diff 被截断 | 大 diff 的某些 hunks 在 API 返回中被截断 | 换到可定位的 hunk，或降级为顶层 Note |
| `diff_refs` 错误 | `base_sha` / `head_sha` / `start_sha` 必须与 MR 当前状态匹配 | 从 GitLab MR API 重新获取 `.diff_refs`，不要假设 `start_sha == base_sha` |

**降级方案**：当 DiffNote 无法定位时，改为发表顶层 Note，并在 body 中写明文件和行号：

```bash
../scripts/briar-mr-review.sh comment <domain> <project_path> <mr_iid> "[AI Review] app/foo.ts:42 ..."
```

### 批量添加 DiffNote

当 review 意见较多时，先把评论整理成 JSON 文件，再用 `post-notes` action 批量提交：

```bash
cat > /tmp/comments.json << 'EOF'
[
  {"path": "src/Foo.ts", "line": 42, "body": "[AI Review] 🔴 严重：..."},
  {"path": "src/Bar.ts", "line": 88, "body": "[AI Review] 🟡 建议：..."}
]
EOF

../scripts/briar-mr-review.sh post-notes <domain> <project_path> <mr_iid> /tmp/comments.json
```

脚本会自动获取 `diff_refs`、逐条提交，并输出每行的成功/失败结果。

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
# 创建 worktree：调用 using-git-worktrees skill
# 清理 worktree：调用 using-git-worktrees skill

# 验证
../../briar-fix/scripts/briar-fix.sh verify <worktree_path>

# 展示 diff 等用户确认
../../briar-fix/scripts/briar-fix.sh diff <worktree_path>

# 用户确认后提交
../../briar-fix/scripts/briar-fix.sh commit <worktree_path> "fix: 按 review 修复"
../../briar-fix/scripts/briar-fix.sh push <worktree_path>
```

### 输出总结

| # | 评论摘要 | 是否合理 | 状态 | 原因 |
|---|---------|---------|------|------|
| 1 | 移除 `parentComponent: this` | ✅ | 已修复 | - |
| 2 | `channelId` 语义不一致 | ✅ | 已修复 | - |
| 3 | 静默过滤建议加错误提示 | ❌ | 跳过 | 异常场景极少，属防御性建议 |

---

## 六、批量/并行 Review 工作流

当用户一次给出多个 MR（如 4 个端各一个 MR）时，可并行 review，但主 Agent 必须做最终过滤和评论发布。

### 推荐流程

```
用户给出 N 个 MR 链接/分支
  ↓
反查每个 MR 的 iid（briar-mr-review.sh find）
  ↓
并行创建 worktree 并生成报告（子 Agent）
  ↓
主 Agent 汇总报告，过滤评论
  ↓
批量发布 DiffNote（briar-mr-review.sh post-notes）
  ↓
对定位失败的评论降级为顶层 Note
```

### 子 Agent 输入格式

给每个子 Agent 传递一个结构化字符串，避免解析歧义：

```
repo_name|gitlab_project_path|mr_iid|local_repo_path|source_branch
```

示例：

```
wsc-pc-shop|wsc-node/wsc-pc-shop|3866|/Users/zhanglei/Documents/gitlab/wsc-pc-shop|hotfix/20260625-customer-sales-name
```

### 子 Agent 输出要求

子 Agent 完成 review 后必须返回：
1. 报告文件路径：`/Users/zhanglei/Desktop/review-report-<repo>-<iid>.md`
2. 建议评论 JSON 数组（最多 5 条）：
   ```json
   [
     {"path": "src/Foo.ts", "line": 42, "body": "[AI Review] ..."}
   ]
   ```

### 主 Agent 过滤规则

批量发布前，主 Agent 必须：
1. 获取每个 MR 的 `changes` 文件白名单；
2. 丢弃不在白名单中的评论；
3. 验证关键评论行号是否在 diff 中可见；
4. 对无法定位的评论改用顶层 Note。

### 报告命名

统一命名避免并发覆盖：

```
review-report-<repo_name>-<mr_iid>.md
```
