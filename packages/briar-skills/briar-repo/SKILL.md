---
name: briar-repo
description: 仓库管理：拉取、更新、清理、创建/删除 worktree。为 briar-fix 提供隔离修复环境。
---

# briar-repo: 仓库管理工具

## 概述

本 skill 负责仓库的**本地维护**：

| 能力 | 说明 |
|------|------|
| **更新仓库** | stash 当前改动 → fetch --all → pull 所有跟踪分支 |
| **清理工作区** | 删除所有 worktree → update（保持主仓库干净最新） |

**拉取仓库**：统一由 `zan-gitlab` skill 处理，它支持通过应用名、URL、Dubbo 服务、npm 包等业务线索定位仓库并同步到本地。`briar-repo` 不再自行实现 pull。

**Worktree 管理**：没有独立的 worktree skill，直接使用 `git worktree` 原生命令（见「三、Worktree 管理」）；`briar-fix` 创建/清理 worktree 时同样用原生命令。

**与 briar-fix 的关系**：
- worktree 创建/清理：直接用 `git worktree` 原生命令（见「三、Worktree 管理」）
- `briar-fix` 负责 worktree 内的**代码修复**（verify、diff、commit、push）
- `briar-repo` 负责仓库本地更新和清理

---

## Token 管理

与 `briar-mr` 共用同一个 `.env` 文件：

```bash
# 读取 GITLAB_TOKEN / GITHUB_TOKEN：优先环境变量 → 全局配置
if [ -z "$GITLAB_TOKEN" ]; then
    ENV_FILE="$HOME/.config/briar-skills/.env"
    if [ -f "$ENV_FILE" ]; then
        export GITLAB_TOKEN=$(grep GITLAB_TOKEN "$ENV_FILE" | cut -d= -f2-)
    fi
fi

if [ -z "$GITHUB_TOKEN" ]; then
    ENV_FILE="$HOME/.config/briar-skills/.env"
    if [ -f "$ENV_FILE" ]; then
        export GITHUB_TOKEN=$(grep GITHUB_TOKEN "$ENV_FILE" | cut -d= -f2-)
    fi
fi
```

如果 `.env` 中不存在 `GITLAB_TOKEN`，**必须主动向用户索要**：

> "我需要 GitLab Access Token 才能搜索和克隆仓库。请提供一个有 `read_api` 权限的 token。我会将其保存在本地 `.env` 文件中，不会提交到 Git。"

对于 GitHub 私有仓库，脚本会优先从 `briar-assets/briar/.env` 读取 `BRIAR_GITHUB_TOKEN`；未找到时再向用户索要。

---

## 行为索引

| 行为 | 触发关键词 | 负责方 | 命令 |
|------|-----------|--------|------|
| 拉取/定位仓库 | "帮我拉 xxx"、"克隆 xxx"、"这个应用在哪个仓库" | `zan-gitlab` skill | 调用 `zan-gitlab` |
| 更新仓库 | "更新 xxx"、"pull 一下" | `briar-repo` | `briar-repo.sh update <repo> [base_dir]` |
| 清理工作区 | "保持干净"、"清理 xxx" | `briar-repo` | `briar-repo.sh clean <repo> [base_dir]` |
| 创建/删除 Worktree | "建 worktree"、"删 worktree" | 原生 git 命令 | `git worktree add` / `git worktree remove`（见「三、Worktree 管理」） |

**参数说明**：
- `<repo>`: 仓库名称（脚本默认在 `base_dir` 下查找 `base_dir/<repo>`）
- `[base_dir]`: 可选，仓库所在的父目录。未指定时回退到 `$HOME/projects`，建议显式传入。

---

## 一、更新仓库（update）

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

## 二、清理工作区（clean）

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

## 三、Worktree 管理

**触发条件**：用户说"建 worktree"、"隔离环境改代码"、"删 worktree"。

没有独立的 worktree skill，直接用 `git worktree` 原生命令：

```bash
# 创建：基于远程主分支新建分支，worktree 放主仓库同级目录
cd "$LOCAL_PATH"
git fetch origin
git worktree add "$(dirname "$LOCAL_PATH")/<repo>-<task>" -b <branch> origin/<base-branch>

# 含子模块的仓库需要初始化子模块
cd "$(dirname "$LOCAL_PATH")/<repo>-<task>" && git submodule update --init

# 列出
git worktree list

# 删除（有未提交改动时先 stash 或确认丢弃）
git worktree remove <path>        # 有改动时需 --force
git worktree prune                # 清理已失效的 worktree 记录
```

约定：worktree 目录命名为 `<repo>-<task>`（如 `briar-display-remove-wiki`），放在主仓库的**同级目录**，避免污染主仓库工作区。

---

## 已知陷阱

### 1. 脚本默认 `BASE_DIR` 已简化

`pull` 移除后，`briar-repo` 只操作本地已有仓库。`update`/`clean` 默认在 `$HOME/projects/<repo>` 查找，若仓库在其他位置，请显式传入 `base_dir`：

```bash
./briar-repo.sh clean briar-display "$HOME/work"
```

> 当不确定仓库路径时，优先使用 `pwd` 或向用户确认，而不是依赖默认值。

---

## 与 briar-fix 的配合

`briar-fix` 的工作流：

1. **创建 worktree**：`git worktree add`（见「三、Worktree 管理」）
2. **修复代码**：在 worktree 内执行
3. **验证/展示 diff/提交/push**：调用 `briar-fix.sh`
4. **清理 worktree**：`git worktree remove <path>`

`briar-repo` 仅负责本地仓库的更新和清理，不直接参与 worktree 管理。

`briar-fix` 保留的能力：
- `verify`：运行 typecheck/lint
- `diff`：展示当前修改
- `commit`：提交修改
- `push`：push 到远程
