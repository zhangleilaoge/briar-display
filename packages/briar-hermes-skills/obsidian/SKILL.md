---
name: obsidian
description: >
  Hermes 知识管理准则。定义 agent 所有记忆与知识的存储、组织、检索规范。
  Obsidian vault 是唯一的技术知识持久化载体，memory 仅存轻量用户画像。
  触发场景：
  1. 遇到值得沉淀的知识（踩坑、工具用法、架构决策、环境细节）→ 写入 vault
  2. 回答技术问题前 → 先搜 vault
  3. 用户说"记一下"、"查一下"、"看看知识库" → 操作 vault
  4. 用户说"迁移 notes" → 将 ~/notes/ 迁移到 vault
---

# Obsidian 知识管理准则

## 核心原则

**vault 是 agent 的大脑，memory 只是身份标签。**

| 存储 | 放什么 | 不放什么 |
|------|--------|----------|
| **vault** | 技术知识、踩坑记录、工具用法、架构决策、环境细节、项目笔记 | 用户偏好、会话级临时状态 |
| **memory** | 用户身份、偏好、沟通风格、环境事实（精简） | 技术细节、操作步骤、过期信息 |

判断标准：**这条信息一周后还有用吗？**
- 是 → vault（持久化知识）
- 否 → 不存或仅保留在当前会话
- 是关于"用户是谁" → memory

---

## 何时写入 vault

**主动写入**（遇到以下场景时 agent 应自动触发）：

| 场景 | 写入位置 | 示例 |
|------|----------|------|
| 踩坑并解决 | `2-areas/<领域>/pitfalls/` | Docker 网络问题、Hono basePath 陷阱 |
| 学到工具新用法 | `3-resources/tools/<工具>.md` | git worktree、hermes config set |
| 项目架构/约定 | `1-projects/<项目>.md` | briar-display 的路由架构、RBAC 模型 |
| 网络/环境配置 | `2-areas/networking/` | VPN 重连、代理配置 |
| 临时想法/待整理 | `0-inbox/` | 用户随口提的需求、灵感 |

**不写入**：
- 用户偏好（→ memory）
- 一次性操作的结果（如"刚查了某个日志"）
- 会过期的临时状态（如"当前分支是 feat/xxx"）

---

## Vault 结构（PARA 方法）

```
~/briar-vault/
├── 0-inbox/              # 快速捕获，待分类整理
├── 1-projects/           # 活跃项目（有明确目标和截止日期）
│   └── briar-display.md  # 项目级知识聚合
├── 2-areas/              # 持续关注领域（无截止日期）
│   ├── devops/
│   ├── networking/
│   └── ...
├── 3-resources/          # 参考资料（工具、框架、外部知识）
│   ├── tools/
│   └── frameworks/
├── 4-archives/           # 已完成/不再活跃
├── templates/            # 笔记模板
└── attachments/          # 图片、附件
```

**分类原则**：
- `0-inbox/`：刚写入的、还没想好放哪的，定期整理到对应目录
- `1-projects/`：和具体项目直接相关的（如 briar-display 的部署流程）
- `2-areas/`：跨项目的持续关注领域（如 devops、networking、security）
- `3-resources/`：纯参考资料，不依赖特定项目（如 git 命令、hermes 配置）
- `4-archives/`：已完成的项目、过时的知识

---

## 笔记格式

```markdown
---
title: Note Title
created: 2026-06-14
updated: 2026-06-14
tags: [category, subcategory]
aliases: [alias1]
status: active
---

# Note Title

正文内容...
```

### Frontmatter 字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `title` | ✅ | 笔记标题 |
| `created` | ✅ | 创建日期 |
| `updated` | ✅ | 最后更新日期 |
| `tags` | ✅ | 标签，用于分类和搜索 |
| `aliases` | ❌ | 别名，Obsidian 搜索可用 |
| `status` | ❌ | `active` / `archived` / `wip` |

### 标签规范

- 格式：`[领域/子领域]`，如 `[devops/docker]`、`[tools/git]`
- 踩坑类笔记加 `pitfall` 标签
- 工具参考加 `tool` 标签

---

## 链接规范

使用 `[[Note Name]]` 建立双向链接，这是 Obsidian 图谱的核心。

**必须链接的场景**：
- 提到另一个笔记的内容时：`参考 [[Git Worktree 用法]]`
- 笔记之间有依赖关系时：`前置知识 [[Docker 网络]]`
- 同一问题的不同方面：在各笔记中互相链接

**链接命名**：
- 链接目标是笔记文件名（不含路径和 .md）
- 同名有歧义时用路径：`[[3-resources/tools/git]]`
- Obsidian 会自动匹配，不需要写全路径

---

## 检索策略

**回答技术问题前，先搜 vault：**

```
1. obsidian.sh search "<关键词>"
2. 如果找到相关笔记 → 读取并引用
3. 如果没找到 → 回答问题后将新知识写入 vault
```

**搜索优先级**：
1. 精确标签搜索（frontmatter tags）
2. 全文搜索（obsidian.sh search）
3. 按目录浏览（obsidian.sh list）

---

## 沉淀流程

```
遇到新知识
  ↓
是技术知识 / 踩坑 / 工具用法？
  ├── 是 → 写入 vault 对应目录
  │         1. 确定分类（project / area / resource）
  │         2. 写入或更新笔记
  │         3. 添加 wikilink 关联已有笔记
  │         4. 打标签
  └── 否 → 是否关于用户偏好？
              ├── 是 → 写入 memory
              └── 否 → 不存
```

---

## 脚本用法

```bash
# 初始化
obsidian.sh init

# 写入
obsidian.sh write 3-resources/tools/git -c '内容' --tags "git,tools"

# 读取
obsidian.sh read 3-resources/tools/git

# 搜索
obsidian.sh search "docker"

# 列出
obsidian.sh list
obsidian.sh list 2-areas

# 链接
obsidian.sh link 1-projects/briar-display "Git Worktree 用法"

# 标签
obsidian.sh tags

# 图谱统计
obsidian.sh graph

# 迁移旧笔记
obsidian.sh migrate
```

---

## 与 memory 的协作

**memory 存什么**（由 Hermes memory 工具管理）：
- 用户身份：公司、角色、GitLab/JIRA 用户名
- 用户偏好：沟通风格、token 敏感度、多模态偏好
- 环境事实：服务器内存、磁盘、已装工具
- 工具 quirks：脚本路径约定、已知问题

**vault 存什么**（由本 skill 管理）：
- 技术知识：怎么用某个工具、某个框架的陷阱
- 项目知识：briar-display 的架构、部署流程
- 环境知识：网络配置、VPN 重连方法
- 踩坑记录：遇到的问题和解决方案

**关键区别**：
- memory 是"我是谁、我习惯什么"→ 精简、每次注入
- vault 是"我知道什么"→ 丰富、按需检索

---

## 同步到本地

用户在自己电脑上用 Obsidian 打开 vault：

```bash
# 方案 A：Git（推荐）
cd ~/briar-vault && git init && git add . && git commit -m "init"
git remote add origin <repo> && git push -u origin main
# 用户：git clone → Obsidian "Open folder as vault"

# 方案 B：Syncthing / rsync
# 直接同步 ~/briar-vault/ 目录
```

---

## 已知陷阱

1. **路径不带 .md 后缀**：`obsidian.sh read 3-resources/tools/git`（不是 git.md）
2. **content 用单引号**：`-c '含 `backticks` 的内容'`，避免 bash 解释
3. **vault 和 memory 不重复**：同一信息只存一处
4. **新笔记先放 0-inbox**：不确定分类时先放 inbox，后续整理
