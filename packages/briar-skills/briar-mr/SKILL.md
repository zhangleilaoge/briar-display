---
name: briar-mr
description: GitLab MR 工具：创建 MR、获取/发表/回复评论、review、pipeline、待回复汇总。修复代码转 briar-fix。
---

# briar-mr: GitLab MR 全能工具入口

## Token 管理

### 自动加载（脚本内置）

所有 `briar-mr-*.sh` 脚本内置 `load_gitlab_token()` 函数，**无需手动设置 token**。加载优先级：

1. 环境变量 `GITLAB_TOKEN`（调用方已设置且非占位符 `***`）
2. `~/.config/briar-skills/.env`（source 加载）
3. `~/.git-credentials` 中的 oauth2 token（兜底提取）

脚本调用示例（无需预设 token）：
```bash
# 直接调用，token 自动加载
briar-mr-review.sh fetch gitlab.qima-inc.com fe/scrm-mono 4876
briar-mr-pipeline.sh gitlab.qima-inc.com fe/scrm-mono 4876
briar-mr-pending.sh 7 scrm-mono
```

### ⚠️ 禁止裸 curl（安全规则）

**所有 GitLab API 操作优先通过 `briar-mr-*.sh` 脚本执行，禁止直接在 `terminal()` 中写 curl 命令。**

原因：`terminal()` 直接跑 curl 带 token 会被 Hermes security scan 标记为 `[HIGH] Pipe to interpreter`，反复触发命令审批，阻塞工作流。

```bash
# ✅ 正确：用脚本
briar-mr-review.sh fetch gitlab.qima-inc.com fe/scrm-mono 4876

# ❌ 错误：裸 curl（会被 security scan 拦截）
curl -s --header "PRIVATE-TOKEN: $TOKEN" "https://gitlab.qima-inc.com/api/v4/..."
```

**例外**：当某个 API 操作没有现成原子脚本时，可把 curl 调用写入临时脚本文件再执行（token 仍由脚本自动加载或从 `.env` 读取），避免 token 暴露在 `terminal()` 命令行。例如：

```bash
# ✅ 可接受：通过脚本文件调用 API
cat > /tmp/find-mr.sh << 'EOF'
#!/bin/bash
source "$HOME/.config/briar-skills/.env"
curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "https://gitlab.qima-inc.com/api/v4/projects/wsc-node%2Fwsc-pc-shop/merge_requests?state=all&source_branch=feat/foo"
EOF
chmod +x /tmp/find-mr.sh
/tmp/find-mr.sh
```

> 优先使用新增的原子脚本：`briar-mr-review.sh find` / `briar-mr-review.sh post-notes`。

### 手动存储 Token

如果脚本自动加载失败（三层都没有有效 token），需要手动写入：

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
| 查找 MR | "找一下 MR"、"这个分支的 MR"、Ungoro 链接反查 | [docs/review.md](docs/review.md) | `briar-mr-review.sh find` |
| 获取评论 | "看看评论"、"获取评论"、"列出评论" | [docs/review.md](docs/review.md) | `briar-mr-review.sh fetch` |
| 发表评论 | "发表评论"、"加条评论" | [docs/review.md](docs/review.md) | `briar-mr-review.sh comment` |
| 批量添加 DiffNote | "把 review 意见发上去"、"添加行级评论" | [docs/review.md](docs/review.md) | `briar-mr-review.sh post-notes` |
| 回复 Discussion | "回复这些评论"、"逐条回复"、"给评论写回复" | [docs/review.md](docs/review.md) | `briar-mr-review.sh reply` |
| Review 代码 | "review"、"看看代码"、"code review" | [docs/review.md](docs/review.md) | `briar-mr-review.sh diff` |
| 修复评论 | "修复"、"处理 review"、"修掉" | [docs/review.md](docs/review.md) | **代码修复 → [briar-fix](../../briar-fix/SKILL.md)** |
| 获取 Pipeline | "看看 pipeline"、"CI 状态"、"构建结果" | [docs/pipeline.md](docs/pipeline.md) | `briar-mr-pipeline.sh` |
| 列出未回复评论 | "最近 MR 评论"、"待回复评论"、"pending" | [docs/pending.md](docs/pending.md) | `briar-mr-pending.sh [days] [project_filter]` |

> **代码修复统一由 [briar-fix](../../briar-fix/SKILL.md) 处理**：按 comments 修复代码、Pipeline 失败后修复代码等场景，都通过 `briar-fix` 的 worktree 工作流完成。

**重要**：
- 用户只说"MR 链接"而没有明确意图时，默认触发【获取评论】，**不要自动修复**；修复后不要自动回复 Discussion，需等用户明确要求。
- 用户说"看看评论是否合理"时，触发【分析评论】：对每条评论逐条给出合理性判断（✅合理/⚠️合理但有保留/❌不合理），用表格呈现，标注是否需要修复。分析完等用户指示再行动。
- **与 briar-context 的分工**：如果用户在 review MR 前要求"获取这个 MR 的关联需求/背景信息"，调用 `briar-context` 获取 Jira/背景；MR 本身的评论、review、pipeline 等业务操作由本 skill 处理。
- **禁止自行 resolve 评论**：AI 回复 Discussion 时，**只回复、不 resolve**。回应只是让对方了解自己的想法/计划/解释，**不能代替对方判定该评论已经解决**。无论回复内容是认同、解释还是承诺修复，都不得勾选/设置 resolved。

---

## 总入口脚本

所有行为都可通过 `briar-mr.sh` 调用，它会自动路由到对应的原子脚本：

```bash
./scripts/briar-mr.sh <action> [args...]
# 或在 PATH 中直接使用
briar-mr.sh <action> [args...]
```

也可以直接调用原子脚本：

```bash
./scripts/briar-mr-create.sh   <domain> <project_path> <source_branch> <target_branch> <title> [description]
./scripts/briar-mr-review.sh   fetch|comment|reply|diff|find|post-notes <domain> <project_path> <...>
./scripts/briar-mr-pipeline.sh <domain> <project_path> <mr_iid>
./scripts/briar-mr-pending.sh  [domain] [days]
```

---

## 解析 MR URL

### GitLab MR 链接

从用户提供的 URL 提取信息：

```
https://gitlab.qima-inc.com/wsc-node/wsc-pc-channel/-/merge_requests/932
              ↑domain↑     ↑project_path↑                      ↑iid↑
```

- `DOMAIN`: `gitlab.qima-inc.com`（或其他 GitLab 实例）
- `PROJECT_PATH`: `wsc-node/wsc-pc-channel`
- `MR_IID`: `932`

`project_path` 需要 URL 编码：`/` → `%2F`

### 非 GitLab 链接（如 Ungoro Review）

用户有时给出的是内部 CR 平台链接，例如：

```
https://ungoro.qa.qima-inc.com/#/review/detail/3744
```

这些页面通常包含 **开发仓库** 和 **开发分支**。提取后，用 `find` action 反查 GitLab MR：

```bash
briar-mr-review.sh find gitlab.qima-inc.com wsc-node/wsc-pc-shop hotfix/20260625-customer-sales-name
# 输出 iid、title、web_url 等
```

拿到 `iid` 后再走 `fetch` / `diff` / `post-notes` 流程。如需完整代码上下文，调用 `using-git-worktrees` skill 创建 review worktree。

---

## 本地仓库路径

`briar-mr` 操作需要定位本地仓库。默认按域名推断父目录：

| 域名 | 默认本地父目录 |
|------|---------------|
| `gitlab.qima-inc.com` / `gitlab.com` | `$HOME/Documents/gitlab` |
| `github.com` | `$HOME/Documents/github` |
| 其他 | `$HOME/projects` |

如本地仓库不存在，先使用 `zan-gitlab` skill 拉取。

---

## 回复 Discussion

使用脚本的 `reply` action：

```bash
briar-mr-review.sh reply <domain> <project_path> <mr_iid> <discussion_id> "回复内容"
```

获取 discussion_id：先用 `fetch` 拿到 discussions JSON，从中提取目标 comment 的 `id` 字段。

### 只回复、不 resolve

**AI 回复评论时严禁同时 resolve 该评论。** 回复的目的只是让对方了解自己的想法、解释或修复计划，**不是代替对方判定评论已解决**。无论认同评论、解释原因还是承诺修复，都不要将 discussion 标记为 resolved。
