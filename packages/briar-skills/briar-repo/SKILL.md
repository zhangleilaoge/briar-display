---
name: briar-repo
description: >
  仓库管理工具。支持拉取仓库、更新代码、清理工作区、管理 worktree。
  触发场景：
  1. 用户说"帮我拉 xxx"、"克隆 xxx 仓库" → 触发【拉取仓库】
  2. 用户说"更新 xxx 代码"、"pull 一下 xxx" → 触发【更新仓库】
  3. 用户说"保持工作区干净"、"清理 xxx" → 触发【清理工作区】
  4. 用户说"给 xxx 建个 worktree"、"开个 xxx 分支工作区" → 触发【创建 Worktree】
---

# briar-repo: 仓库管理工具

## 概述

本 skill 负责仓库的**全生命周期管理**：

| 能力 | 说明 |
|------|------|
| **拉取仓库** | 从 GitLab 搜索并克隆到本地 |
| **更新仓库** | stash 当前改动 → fetch --all → pull 所有跟踪分支 |
| **清理工作区** | 删除所有 worktree → update（保持主仓库干净最新） |
| **Worktree 管理** | 创建/删除/列出/清理 worktree |

**与 briar-fix 的关系**：
- `briar-repo` 负责 worktree 的**创建和删除**
- `briar-fix` 负责 worktree 内的**代码修复**（verify、diff、commit、push）
- `briar-fix` 的 `setup`/`cleanup` 委托给 `briar-repo` 执行

---

## Token 管理

与 `briar-mr` 共用同一个 `.env` 文件：

```bash
# 读取 GITLAB_TOKEN：优先环境变量 → 全局配置
if [ -z "$GITLAB_TOKEN" ]; then
    ENV_FILE="$HOME/.config/briar-skills/.env"
    if [ -f "$ENV_FILE" ]; then
        export GITLAB_TOKEN=$(grep GITLAB_TOKEN "$ENV_FILE" | cut -d= -f2-)
    fi
fi
```

如果 `.env` 中不存在 `GITLAB_TOKEN`，**必须主动向用户索要**：

> "我需要 GitLab Access Token 才能搜索和克隆仓库。请提供一个有 `read_api` 权限的 token。我会将其保存在本地 `.env` 文件中，不会提交到 Git。"

---

## 行为索引

| 行为 | 触发关键词 | 命令 |
|------|-----------|------|
| 拉取仓库 | "帮我拉 xxx"、"克隆 xxx" | `briar-repo.sh pull <repo> [base_dir]` |
| 更新仓库 | "更新 xxx"、"pull 一下" | `briar-repo.sh update <repo> [base_dir]` |
| 清理工作区 | "保持干净"、"清理 xxx" | `briar-repo.sh clean <repo> [base_dir]` |
| 创建 Worktree | "建 worktree"、"开分支工作区" | `briar-repo.sh worktree add <repo> <branch> [base_dir]` |
| 删除 Worktree | "删 worktree" | `briar-repo.sh worktree remove <repo> <branch> [base_dir]` |
| 列出 Worktree | "看看 worktree" | `briar-repo.sh worktree list <repo> [base_dir]` |
| 清理所有 Worktree | "删掉所有 worktree" | `briar-repo.sh worktree clean <repo> [base_dir]` |

**参数说明**：
- `<repo>`: 仓库名称（脚本默认在 `base_dir` 下查找 `base_dir/<repo>`）
- `[base_dir]`: 可选，仓库所在的父目录，**默认为 `$HOME/projects`**。如果仓库不在该路径下，必须显式传入。

---

## 一、拉取仓库（pull）

**触发条件**：用户说"帮我拉 xxx"、"克隆 xxx 仓库"。

### 流程

1. **检查本地是否已存在**
   ```bash
   LOCAL_PATH="$HOME/projects/<repo-name>"
   if [ -d "$LOCAL_PATH/.git" ]; then
       echo "本地已有该仓库"
   fi
   ```

2. **搜索 GitLab 项目**
   ```bash
   curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
     "https://gitlab.qima-inc.com/api/v4/projects?search=<repo-name>&per_page=20"
   ```

3. **选择仓库**
   - 只有一个结果：直接使用
   - 有多个结果：优先选择 `wsc-node/` 前缀的正式仓库；无法自动选择时，展示列表让用户确认

4. **执行克隆**
   ```bash
   git clone <ssh_url> "$HOME/projects/<repo-name>"
   ```

### 脚本

```bash
./scripts/briar-repo.sh pull <repo-name> [base_dir]
# 或在 PATH 中直接使用
briar-repo.sh pull <repo-name> [base_dir]
```

---

## 二、更新仓库（update）

**触发条件**：用户说"更新 xxx 代码"、"pull 一下 xxx"。

### 流程

```bash
cd "$LOCAL_PATH"

# 1. stash 当前改动
git stash push -m "briar-repo auto-stash $(date +%s)"

# 2. fetch 所有远程
git fetch --all

# 3. 逐个 pull 有 upstream 的本地分支
for branch in $(git branch --format='%(refname:short)'); do
    upstream=$(git rev-parse --abbrev-ref "$branch@{upstream}" 2>/dev/null || true)
    if [ -n "$upstream" ]; then
        git checkout "$branch"
        git pull origin "$branch"
    fi
done

# 回到原来的分支
git checkout "$CURRENT_BRANCH"
```

### 脚本

```bash
./scripts/briar-repo.sh update <repo-name> [base_dir]
# 或在 PATH 中直接使用
briar-repo.sh update <repo-name> [base_dir]
```

---

## 三、清理工作区（clean）

**触发条件**：用户说"保持工作区干净"、"清理 xxx"。

### 流程

先删除所有 worktree，再 update：

```bash
# 1. 删除所有 worktree（先 stash 未提交改动）
for wt in $(git worktree list --porcelain | grep '^worktree ' | tail -n +2 | cut -d' ' -f2-); do
    cd "$wt"
    git stash push -m "..."
    cd "$REPO_PATH"
    git worktree remove "$wt" || rm -rf "$wt"
done
git worktree prune

# 2. update（stash + fetch --all + pull）
# 同 update 行为
```

### 脚本

```bash
./scripts/briar-repo.sh clean <repo-name> [base_dir]
# 或在 PATH 中直接使用
briar-repo.sh clean <repo-name> [base_dir]
```

---

## 四、Worktree 管理

> 通用 worktree 使用方法已由 `using-git-worktrees` 覆盖。本节仅保留 briar 项目的**命名约定**和**快捷命令**。

**触发条件**：用户说"给 xxx 建个 worktree"、"开个 xxx 分支工作区"、"删 worktree"。

### 命名规则

| 项目 | 约定 |
|------|------|
| 名称格式 | `仓库名-分支名`（`/` 替换为 `-`） |
| 存放位置 | 仓库**同级目录** |

示例：仓库 `~/projects/wsc-pc-channel` + 分支 `feat/foo` → Worktree `~/projects/wsc-pc-channel-feat-foo`

### 快捷命令

```bash
briar-repo.sh worktree add    <repo> <branch> [base_dir]  # 创建（存在则复用+stash）
briar-repo.sh worktree remove <repo> <branch> [base_dir]  # 删除（先 stash）
briar-repo.sh worktree list   <repo> [base_dir]           # 列出
briar-repo.sh worktree clean  <repo> [base_dir]           # 清理全部
```

---

## 已知陷阱

### 1. 脚本默认 `BASE_DIR` 为 `$HOME/projects`

**错误示例**（仓库实际在 `~/work/briar-display`，不在默认 `$HOME/projects` 下）：
```bash
./briar-repo.sh clean briar-display
# Error: $HOME/projects/briar-display is not a git repository.
```

**正确做法**：显式传入 `base_dir` 参数：
```bash
./briar-repo.sh clean briar-display "$HOME/work"
./briar-repo.sh worktree add briar-display test/20260522 "$HOME/work"
```

> 当不确定仓库路径时，优先使用 `pwd` 或向用户确认，而不是依赖默认值。

### 2. 手动 `git worktree add` 与脚本行为不一致

手动执行 `git worktree add .worktrees/test-20260522 test/20260522` 会把 worktree 放在仓库**子目录**下，而 briar 约定放在**同级目录**。清理工作区时脚本可能找不到手动创建的 worktree，此时直接用 `git worktree list` 查看实际路径后删除。

---

## 与 briar-fix 的配合

`briar-fix` 的 `setup` 和 `cleanup` 委托给 `briar-repo`：

```bash
# briar-fix setup → 实际调用 briar-repo worktree add
briar-repo.sh worktree add <repo-name> <branch>

# briar-fix cleanup → 实际调用 briar-repo worktree remove
briar-repo.sh worktree remove <repo-name> <branch>
```

`briar-fix` 保留的能力：
- `verify`：运行 typecheck/lint
- `diff`：展示当前修改
- `commit`：提交修改
- `push`：push 到远程
