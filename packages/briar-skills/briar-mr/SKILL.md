---
name: briar-mr
description: >
  GitLab Merge Request（MR）全能工具：创建 MR、获取评论、发表评论、按评论修复代码。
  触发场景：
  1. 用户说"提个 MR"、"创建 MR"、"提交合并请求" → 触发【创建 MR】（自动推导标题和内容）
  2. 用户给出 GitLab MR 链接，要求"看看评论"、"获取评论"、"列出评论" → 触发【获取评论】
  3. 用户要求在 MR 中"发表评论"、"加一条评论"、"回复评论" → 触发【发表评论】
  4. 用户要求"按评论修复代码"、"处理 code review"、"修掉评论里的问题" → 触发【修复评论】
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

### 输出示例

创建成功后返回：

```
✅ MR created successfully!
   IID: 1234
   URL: https://gitlab.qima-inc.com/wsc-node/wsc-pc-channel/-/merge_requests/1234
```

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

**触发条件**：用户说"在 MR 里加条评论"、"回复这条评论"、"发表一下意见"。

**只做一件事**：在 MR 中发表一条新评论，**不获取、不修复**。

### API

```bash
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

## 行为四：修复评论（fix）

**触发条件**：用户说"按评论修复"、"处理 code review"、"修掉问题"、"分析并修复"。

**依赖行为二**：必须先获取所有评论，再分析和修复。

### 步骤

1. **获取评论**（同行为二）
2. **分析合理性**：逐条判断是否合理、是否该修复
3. **执行修复**：合理的修复，不合理的跳过并说明原因
4. **验证**：TypeScript 编译检查
5. **输出总结**

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

## 四种行为速查

| 行为 | 触发关键词 | 所需权限 | 自动执行？ |
|------|-----------|---------|-----------|
| 创建 MR | "提个 MR"、"创建 MR"、"提交合并请求" | `api` | 是（自动推导标题内容） |
| 获取评论 | "看看评论"、"获取评论"、"列出" | `read_api` | 是 |
| 发表评论 | "发表评论"、"加条评论"、"回复" | `api` | 需确认内容 |
| 修复评论 | "修复"、"处理 review"、"修掉" | `read_api` | 是（分析后） |

**重要**：用户只说"MR 链接"而没有明确意图时，默认触发【获取评论】，**不要自动修复**。
