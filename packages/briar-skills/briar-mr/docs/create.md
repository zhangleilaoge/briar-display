# 创建 MR（create）

**触发条件**：用户说"提个 MR"、"创建 MR"、"提交合并请求"、"发一个 MR"。

**核心能力**：自动推导 MR 标题和内容，无需用户手动填写。

---

## 前置要求

- 必须知道**仓库本地路径**（从用户提供的文件路径或当前工作目录推断）
- 必须知道**源分支**（source_branch）和**目标分支**（target_branch，默认 `master`）
- 必须有未合并到目标分支的 commit

---

## 自动推导逻辑

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

### 标题推导规则

| commit 数量 | 标题来源 | 示例 |
|------------|---------|------|
| 1 | 直接使用该 commit 的 subject | `refactor(omni-channel): 优化抖音相关授权及列表逻辑` |
| ≥2 | 取**第一个 commit 的 subject**；如果是 WIP/fixup，取第二个或分支名推断 | `feat: 多渠道授权功能合集` |

> 如果分支名符合 `feat/xxx`、`fix/xxx`、`hotfix/xxx` 且 commit subject 没有前缀，可给标题加上对应前缀（如 `feat:`、`fix:`）。

### 内容推导规则

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

---

## 执行创建

推导完成后调用脚本：

```bash
./packages/briar-skills/briar-mr/scripts/briar-mr-create.sh \
  <domain> <project_path> <source_branch> <target_branch> "<title>" "<description>"
```

或通过总入口：

```bash
./packages/briar-skills/briar-mr/scripts/briar-mr.sh create \
  <domain> <project_path> <source_branch> <target_branch> "<title>" "<description>"
```

---

## 输出与反馈

创建成功后**必须将 MR 链接展示给用户**：

```
✅ MR created成功！
   链接：https://gitlab.qima-inc.com/wsc-node/wsc-pc-channel/-/merge_requests/1234
```

> 不要只返回 IID 或只写"创建成功"，用户需要直接点击链接查看 MR。
