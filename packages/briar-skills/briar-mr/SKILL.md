---
name: briar-mr
description: >
  GitLab Merge Request（MR）全能工具入口。包含创建 MR、评论处理（fetch/review/fix/reply/comment）、Pipeline 查询、待回复评论汇总。
  触发场景：
  1. 用户说"提个 MR"、"创建 MR"、"提交合并请求" → 触发【创建 MR】
  2. 用户给出 GitLab MR 链接，要求"看看评论"、"获取评论"、"列出评论" → 触发【获取评论】
  3. 用户要求在 MR 中"发表评论"、"加一条评论" → 触发【发表评论】
  4. 用户要求"回复这些评论"、"逐条回复"、"给评论写回复" → 触发【回复 Discussion】
  5. 用户说"看看 pipeline"、"CI 状态"、"构建结果" → 触发【获取 Pipeline】
  6. 用户说"review 这个 MR"、"帮我看看代码"、"code review" → 触发【Review 代码】
  7. 用户要求"按评论修复代码"、"处理 code review"、"修掉评论里的问题" → 触发【修复评论】
  8. 用户说"看看我最近的 MR 有哪些评论没回"、"最近 MR 评论"、"待回复评论" → 触发【列出未回复评论】
  本 skill 不会默认执行全部能力，严格根据用户意图触发对应行为。
---

# briar-mr: GitLab MR 全能工具入口

## Token 管理

### 检查 Token

读取 skill 目录下的 `.env` 文件：

```bash
# 读取 GITLAB_TOKEN：优先环境变量 → 全局配置
if [ -z "$GITLAB_TOKEN" ]; then
    ENV_FILE="$HOME/.config/briar-skills/.env"
    if [ -f "$ENV_FILE" ]; then
        export GITLAB_TOKEN=$(grep GITLAB_TOKEN "$ENV_FILE" | cut -d= -f2-)
    fi
fi
```

### 索要 Token

如果 `.env` 中不存在 `GITLAB_TOKEN`，**必须主动向用户索要**：

> "我需要 GitLab Access Token 才能操作 MR。请提供一个有 `read_api` + `api` 权限的 token（`api` 权限用于创建 MR 和发表评论，`read_api` 用于获取评论）。我会将其保存在本地 `.env` 文件中，不会提交到 Git。"

### 存储 Token

拿到 token 后写入 `.env`：

```bash
mkdir -p "$HOME/.config/briar-skills"
echo "GITLAB_TOKEN=YOUR_TOKEN" > "$HOME/.config/briar-skills/.env"
chmod 600 "$HOME/.config/briar-skills/.env"
```

---

## 行为索引

| 行为 | 触发关键词 | 文档 | 原子脚本 |
|------|-----------|------|---------|
| 创建 MR | "提个 MR"、"创建 MR"、"提交合并请求" | [docs/create.md](docs/create.md) | `briar-mr-create.sh` |
| 获取评论 | "看看评论"、"获取评论"、"列出评论" | [docs/review.md](docs/review.md) | `briar-mr-review.sh fetch` |
| 发表评论 | "发表评论"、"加条评论" | [docs/review.md](docs/review.md) | `briar-mr-review.sh comment` |
| 回复 Discussion | "回复这些评论"、"逐条回复"、"给评论写回复" | [docs/review.md](docs/review.md) | `briar-mr-review.sh reply` |
| Review 代码 | "review"、"看看代码"、"code review" | [docs/review.md](docs/review.md) | `briar-mr-review.sh diff` |
| 修复评论 | "修复"、"处理 review"、"修掉" | [docs/review.md](docs/review.md) | **代码修复 → [briar-fix](../../briar-fix/SKILL.md)** |
| 获取 Pipeline | "看看 pipeline"、"CI 状态"、"构建结果" | [docs/pipeline.md](docs/pipeline.md) | `briar-mr-pipeline.sh` |
| 列出未回复评论 | "最近 MR 评论"、"待回复评论"、"pending" | [docs/pending.md](docs/pending.md) | `briar-mr-pending.sh [days] [project_filter]` |

> **代码修复统一由 [briar-fix](../../briar-fix/SKILL.md) 处理**：按 comments 修复代码、Pipeline 失败后修复代码等场景，都通过 `briar-fix` 的 worktree 工作流完成。

**重要**：
- 用户只说"MR 链接"而没有明确意图时，默认触发【获取评论】，**不要自动修复**；修复后不要自动回复 Discussion，需等用户明确要求。
- **与 briar-context 的分工**：如果用户在 review MR 前要求"获取这个 MR 的关联需求/背景信息"，调用 `briar-context` 获取 Jira/背景；MR 本身的评论、review、pipeline 等业务操作由本 skill 处理。

---

## 总入口脚本

所有行为都可通过 `briar-mr.sh` 调用，它会自动路由到对应的原子脚本：

```bash
./packages/briar-skills/briar-mr/scripts/briar-mr.sh <action> [args...]
```

也可以直接调用原子脚本：

```bash
./scripts/briar-mr-create.sh   <domain> <project_path> <source_branch> <target_branch> <title> [description]
./scripts/briar-mr-review.sh   fetch|comment|reply|diff <domain> <project_path> <mr_iid> [...]
./scripts/briar-mr-pipeline.sh <domain> <project_path> <mr_iid>
./scripts/briar-mr-pending.sh  [domain] [days]
```

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
