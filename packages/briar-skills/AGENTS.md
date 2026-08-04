# @briar/skills — Agent Guide

## 概述

`@briar/skills` 是 Briar Display 的 **Agent Skill 集合**，供 kimi-cli 识别和调用。每个 skill 是一个自包含目录，包含 `SKILL.md`（指令文档）和可选的 `scripts/`（辅助脚本）。

---

## 包含的 Skill

| Skill | 作用 |
|-------|------|
| `briar-context` | 通过 URL 获取页面上下文（Jira、GitLab MR、内网文档等） |
| `briar-fix` | 基于 Git worktree 的安全代码修复 |
| `briar-mr` | GitLab MR 全能工具（创建、评论、review、pipeline） |
| `briar-repo` | 从 GitLab 搜索并克隆仓库到本地 |
| `briar-sync` | 反合主分支：将最新 master/main 合入开发分支，自动处理简单冲突 |
| `briar-skynet` | 天网日志查询、traceId 链路追踪与日志导出下载 |
| `briar-session` | 按时间范围查找历史 kimi-code 会话（主题、目录、会话 ID、恢复命令） |
| `briar-get-session-id` | 按时间窗口 + （定制页面 key 或 kdtId）查询有效导购登录 sessionId（天网日志 + Dubbo 校验） |

---

## Skill 注册方式

kimi-cli 按 scope 扫描 skill，优先级：**Project > User > Extra > Built-in**。

### 1. Project scope（当前项目内可用）

`.agents/skills/` 是项目级入口。通过**软链**指向 `packages/briar-skills/` 下的实际 skill，保持单一份代码源：

```bash
# 在项目根目录执行
ln -s "$(pwd)/packages/briar-skills/<skill-name>" .agents/skills/<skill-name>
```

### 2. User scope（任意目录全局可用）

`~/.claude/skills/` 是用户级入口。把需要在**任意项目目录**都能触发的 skill 注册到这里：

```bash
ln -s "$(pwd)/packages/briar-skills/<skill-name>" ~/.claude/skills/<skill-name>
```

> 无需主动为用户将每个 skill 软链到全局，除非用户需要。

---

## 配置与依赖

### GitLab Token

`briar-context`、`briar-mr`、`briar-repo` 都需要 `GITLAB_TOKEN`。读取优先级：

1. 环境变量 `GITLAB_TOKEN`
2. 全局配置文件：`$HOME/.config/briar-skills/.env`
3. （向后兼容）项目内 `.env`

**初始化全局配置**：

```bash
mkdir -p "$HOME/.config/briar-skills"
echo "GITLAB_TOKEN=your_token_here" > "$HOME/.config/briar-skills/.env"
chmod 600 "$HOME/.config/briar-skills/.env"
```

### 本地仓库默认目录

`zan-gitlab` 拉取仓库后默认放在 `$HOME/.gitlab-repos/`；`briar-mr` 查找本地仓库时优先按域名推断（GitLab → `$HOME/Documents/gitlab`，GitHub → `$HOME/Documents/github`，兜底 `$HOME/projects/`）。

拉取/定位仓库请使用 `zan-gitlab` skill：

```bash
# 由 zan-gitlab skill 处理
python3 /Users/zhanglei/.kimi-code/user-skills/zan-gitlab/scripts/zan_gitlab.py '<repo-or-keyword>'
```

---

## 开发约束

### 优先复用 superpowers

新增 skill 前，先检查 superpowers 是否已有同类能力，避免重复造轮子：

| superpowers skill | 已覆盖的场景 |
|-------------------|-------------|
| `using-git-worktrees` | worktree 创建、管理、隔离工作区 |
| `systematic-debugging` | 调试方法论、故障排查流程 |
| `test-driven-development` | TDD 流程、红绿重构循环 |
| `writing-plans` | 实现计划编写、架构设计 |
| `verification-before-completion` | 完成前验证、检查清单 |
| `receiving-code-review` / `requesting-code-review` | 代码审查接收/请求流程 |

> 若 superpowers 已覆盖，本仓库的 skill 只保留**具体工具调用**（如 GitLab API 脚本、AppleScript 抓取），不再重复编写工作流指导。

### 禁止硬编码项目路径

所有 skill 的 `SKILL.md` 和 `scripts/` 中**不得**出现 `/Users/zhanglei/Documents/projects/briar-display` 这类绝对路径。统一使用：

- `$HOME` 代替用户目录
- `$HOME/.config/briar-skills/.env` 代替项目内 `.env`
- `$HOME/projects/` 作为默认代码目录

### 脚本路径引用

`SKILL.md` 中引用脚本时，使用**脚本名**（假设在 `PATH` 中）或相对当前 skill 目录的路径，不要写 `./packages/briar-skills/...`：

```markdown
# ✅ 推荐
bash briar-mr.sh review <url>

# ❌ 避免
bash ./packages/briar-skills/briar-mr/scripts/briar-mr.sh review <url>
```

---

## 添加新 Skill

1. 在 `packages/briar-skills/` 下创建新目录 `<skill-name>/`
2. 编写 `SKILL.md`（必须包含 `name` 和 `description` frontmatter）
3. 如有脚本，放入 `scripts/` 目录
4. 按需在 `.agents/skills/` 和/或 `~/.claude/skills/` 创建软链
5. 更新本 `AGENTS.md` 的 skill 列表
