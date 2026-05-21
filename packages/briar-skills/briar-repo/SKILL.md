---
name: briar-repo
description: >
  仓库拉取工具。自动从 GitLab 搜索仓库并克隆到本地 projects 目录。
  触发场景：
  1. 用户说"帮我拉 xxx"、"克隆 xxx 仓库"、"pull 一下 xxx" → 触发【拉取仓库】
---

# briar-repo: 仓库拉取工具

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

## 行为一：拉取仓库（pull）

**触发条件**：用户说"帮我拉 xxx"、"克隆 xxx 仓库"、"pull 一下 xxx"、"下载 xxx 代码"。

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

5. **反馈结果**
   - 克隆成功：输出本地路径和 Web 链接
   - 本地已有：提示用户并建议 `git pull`
   - 未找到：告知用户仓库不存在

### 脚本

```bash
./packages/briar-skills/briar-repo/scripts/briar-repo.sh pull <repo-name>
```

### 示例

**首次克隆**：
```bash
$ ./briar-repo.sh pull wsc-pc-trade
📦 准备克隆 wsc-node/wsc-pc-trade
   URL: git@gitlab.qima-inc.com:wsc-node/wsc-pc-trade.git
   目标: $HOME/projects/wsc-pc-trade

Cloning into 'wsc-pc-trade'...
✅ 克隆完成：$HOME/projects/wsc-pc-trade
   Web: https://gitlab.qima-inc.com/wsc-node/wsc-pc-trade
```

**本地已有**：
```bash
$ ./briar-repo.sh pull wsc-pc-trade
本地已有该仓库：$HOME/projects/wsc-pc-trade
远程地址：git@gitlab.qima-inc.com:wsc-node/wsc-pc-trade.git
如需更新请执行：cd "$HOME/projects/wsc-pc-trade" && git pull
```

### 注意

- 默认克隆到 `~/Documents/projects/`
- 使用 SSH 协议（`git@gitlab.qima-inc.com`）
- 大仓库克隆可能需要较长时间，可设置超时或后台执行
