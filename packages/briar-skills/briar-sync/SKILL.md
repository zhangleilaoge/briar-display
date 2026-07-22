---
name: briar-sync
description: 将最新主分支（master/main）合入当前开发分支，自动处理简单冲突，复杂冲突交用户决策。可由 briar-mr/briar-fix 触发，也可独立使用。
---

# briar-sync — 反合主分支

将最新主分支合入当前开发分支（或上下文明确指定的开发分支），解决因过早拉分支导致的代码落后问题。

## 触发场景

- 用户说"同步主分支"、"合一下 master"、"分支太旧了更新一下"、"反合"、"merge main"
- briar-mr review 发现分支过旧，建议先同步
- briar-fix 修复前需要同步主分支最新代码

## 工作流

### Step 1 — 环境检测

```bash
bash briar-sync.sh detect
```

脚本输出：当前分支名、主分支名（自动检测）、工作区状态、落后 commit 数、变更文件概览。

**前置条件**：
- 工作区必须干净（无未提交变更）。有脏文件时提示用户先 commit 或 stash，不代为操作。
- 当前不在主分支上（在主分支上无需反合）。
- 若当前在 `merge/*` 分支上，需先 checkout 到对应开发分支（如 `feat/*`）再执行 detect/merge。briar-sync 的操作对象始终是开发分支，不是 merge 分支。

### Step 2 — 评估与确认

向用户报告差距摘要：

> 当前分支 `feat/xxx` 落后 `master` **N 个 commit**，涉及 **M 个文件**。

如果 N = 0，告知"已是最新"并结束。

如果 N > 0，询问用户是否继续（或用户已明确指示则直接执行）。

### Step 3 — 执行合并

```bash
bash briar-sync.sh merge [main-branch]
```

脚本执行 `git fetch origin <main>` + `git merge origin/<main> --no-edit`。

- 无冲突 → 跳到 Step 5
- 有冲突 → 进入 Step 4

### Step 4 — 冲突分级处理

对每个冲突文件，按以下规则分类：

#### 可自动解决（确定性高）

| 类型 | 处理方式 |
|------|----------|
| Lock 文件（yarn.lock, bun.lockb, package-lock.json, pnpm-lock.yaml） | 取主分支版本 → 重新 `bun install` / `yarn install` / `npm install` 生成 → `git add` |
| 纯 import/require 区域追加（双方各加了不同 import，无重叠） | 合并双方 import → `git add` |
| 一方仅空白/格式变更，另一方有实质改动 | 取实质改动方 → `git add` |

#### 需用户介入（不确定）

| 类型 | 处理方式 |
|------|----------|
| 同一函数/代码块的语义冲突 | 展示冲突 hunk + 双方改动意图分析，等用户决策 |
| 删除 vs 修改（一方删了文件/函数，另一方改了它） | 说明双方意图，问用户保留哪边 |
| 大段重叠改动（>20 行交叉） | 列出冲突区域，提供建议但不自动执行 |

**原则：宁可多问用户，不猜。** 自动解决仅限于"答案唯一确定"的情况。

处理完自动解决的文件后：

```bash
bash briar-sync.sh resolve <file1> <file2> ...   # git add 已解决的文件
bash briar-sync.sh status                         # 查看剩余冲突
```

### Step 5 — 验证

```bash
bash briar-sync.sh verify
```

脚本按项目类型选择验证命令（检测 package.json scripts / Makefile）：

1. 构建：`bun run build` / `npm run build` / `make build`
2. Lint：`bun run lint` / `npm run lint`（如有）
3. 类型检查：`bun run typecheck` / `npx tsc --noEmit`（如有）

- 验证通过 → Step 6
- 验证失败 → 报告错误详情，**不自动 commit**，等用户处理

### Step 6 — 完成

Merge commit 由 git 自动生成（`--no-edit`）。输出合并摘要：

- 新增 commit 数
- 自动解决的冲突文件列表
- 用户手动解决的冲突文件列表（如有）
- 验证结果

## 脚本用法

```bash
briar-sync.sh detect              # 环境检测 + 差距评估
briar-sync.sh merge [main]        # fetch + merge（main 默认自动检测）
briar-sync.sh resolve <files...>  # git add 已解决文件
briar-sync.sh status              # 当前冲突状态
briar-sync.sh verify              # 构建/lint/typecheck 验证
briar-sync.sh abort               # 放弃本次 merge（git merge --abort）
```

## 关键约定

- **冲突在开发分支解决**，绝不切到主分支操作
- **不用 `--no-verify`** 跳过 git hook
- **Lock 文件不手动编辑**，取主分支版本后重新 install 生成
- **验证不通过不 commit**，报告用户
- 合并策略统一用 **merge**（不用 rebase），保持历史可追溯
- 如果用户中途想放弃：`briar-sync.sh abort`

## 与其他 skill 的协作

| 场景 | 协作方式 |
|------|----------|
| briar-mr review 发现分支过旧 | briar-mr 建议 → 用户确认 → 触发 briar-sync |
| briar-fix 修复前需同步 | briar-fix 检测落后 → 触发 briar-sync → 同步后继续修复 |
| 同步后需要 push | briar-sync 完成后提示用户是否 push（不自动 push） |
