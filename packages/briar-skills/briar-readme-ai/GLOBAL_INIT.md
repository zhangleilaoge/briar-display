# briar-readme-ai 全局认知初始化协议

> 本文档描述如何将 `briar-readme-ai` 的自动认知能力注入到 Agent 的全局提示词中，实现**跨项目、零手动**的认知加载。

---

## 为什么需要全局注入

项目级的 `AGENTS.md` 只能覆盖单个仓库。如果用户在多个项目间切换，每次都需要手动提醒 Agent "去读一下 skill"。

全局注入解决的是：**Agent 进入任何项目目录时，自动发现 skill、自动执行认知、自动保留触发能力**。

---

## 支持的目标 Agent

| Agent | 全局提示词路径 | 检测方式 |
|-------|--------------|---------|
| **Kimi CLI** | `~/.kimi/prompts/global-rules.md` | 检查 `$HOME/.kimi/prompts/` 目录 |
| **Claude Code** | `~/.claude/CLAUDE.md` 或项目级 `.claude/CLAUDE.md` | 检查 `$HOME/.claude/` 目录 |
| **Cursor** | 项目级 `.cursorrules`（推荐）或 IDE Settings | 检查 `.cursorrules` 或 Cursor 配置目录 |
| **Trae / VS Code 插件类** | 通常无全局提示词文件，需手动配置 | 需用户手动粘贴 |

> 如果你的 Agent 不在列表中，请参考【手动注入】章节。

---

## 自动安装（推荐）

### 一键注入

```bash
bash packages/briar-skills/briar-readme-ai/scripts/init-global-prompt.sh
```

脚本会自动：
1. 检测当前系统安装的 Agent 类型
2. 定位全局提示词文件
3. 检查是否已注入（避免重复）
4. 将【自动认知协议】追加到全局提示词
5. 输出注入结果和验证方式

### 指定 Agent 注入

```bash
# 强制注入到 Kimi CLI
bash packages/briar-skills/briar-readme-ai/scripts/init-global-prompt.sh --agent=kimi

# 强制注入到 Claude Code
bash packages/briar-skills/briar-readme-ai/scripts/init-global-prompt.sh --agent=claude

# 强制注入到当前项目（生成 .cursorrules）
bash packages/briar-skills/briar-readme-ai/scripts/init-global-prompt.sh --agent=cursor --project=.
```

---

## 手动注入

如果自动脚本不支持你的 Agent，按以下步骤手动操作。

### 步骤 1：找到全局提示词文件

各 Agent 的全局提示词位置：

**Kimi CLI**
```bash
mkdir -p ~/.kimi/prompts
touch ~/.kimi/prompts/global-rules.md
```

**Claude Code**
```bash
mkdir -p ~/.claude
touch ~/.claude/CLAUDE.md
```

**Cursor（项目级）**
```bash
# 在项目根目录
touch .cursorrules
```

### 步骤 2：追加自动认知协议

将以下内容追加到找到的文件中：

```markdown
## 项目认知协议

1. `<项目根目录>/packages/briar-skills/briar-readme-ai/SKILL.md` 是管理 `readme.ai.md` 的 skill，操作 `readme.ai.md` 时参考该 skill 行动
2. 任何项目的真相源以 `readme.ai.md` 为准，Agent 进入项目后优先读取
3. `readme.ai.md` 不保存本地，每次从服务端实时读取：`GET https://stardew.site/api/readme-ai?projectName=$(basename "$(pwd)")`
4. 服务端没有时触发【初始化认知】，按 skill 流程扫描代码生成并提交到服务端
```

### 步骤 3：验证

新开一个 Agent Session，进入任意带有 `briar-readme-ai` skill 的项目，直接问：

> "你对这个项目有什么了解？"

如果 Agent 能自动报出 `readme.ai.md` 中的内容，说明注入成功。

---

## 卸载

运行脚本带 `--uninstall` 参数：

```bash
bash packages/briar-skills/briar-readme-ai/scripts/init-global-prompt.sh --uninstall
```

或手动编辑对应的全局提示词文件，删除 `## 🔒 自动认知协议（briar-readme-ai）` 及其后续内容。

---

## 扩展：新增 Agent 支持

如果你使用的 Agent 不在支持列表中，可以：

1. 找到该 Agent 的全局提示词配置文件路径
2. 在 `init-global-prompt.sh` 中新增检测逻辑：
   ```bash
   elif [ -d "$HOME/.your-agent" ]; then
       AGENT="your-agent"
       PROMPT_FILE="$HOME/.your-agent/prompt.md"
   ```
3. 提交 PR 或本地维护

---

## 文件清单

| 文件 | 作用 |
|------|------|
| `SKILL.md` | Skill 本体定义（行为、API、规范） |
| `GLOBAL_INIT.md` | 本文档（全局注入指南） |
| `scripts/init-global-prompt.sh` | 自动注入脚本 |
| `scripts/briar-readme-ai.sh` | Skill 核心操作脚本（read/rewrite/init/delete） |
