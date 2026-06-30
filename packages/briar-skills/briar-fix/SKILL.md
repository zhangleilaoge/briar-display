---
name: briar-fix
description: 用 Git worktree 隔离修复代码：按 MR 评论或 Pipeline 失败修复，验证后提交。通常由 briar-mr 触发。
---

# briar-fix: 代码修复工作流

## 核心思想

**不要直接在主工作区修改代码**——可能当前工作区有未提交的改动、或者正在错误的分支上。使用 **worktree** 创建一个隔离的修复环境：

> Worktree 的创建/删除由 [briar-repo](../briar-repo/SKILL.md) 管理，本 skill 只负责 worktree 内的修复操作。

```
原工作区（feat/xxx，可能有未提交改动）
   └── 不动它

修复 worktree（基于目标分支，干净环境）
   └── 在这里读代码、看评论、做修复、提交
```

---

## 触发条件

| 来源 | 触发场景 |
|------|---------|
| briar-mr review | MR 中有实质性 comments 需要按评论修复代码 |
| briar-mr pipeline | Pipeline 中 lint/test/build 失败需要修代码 |
| 独立使用 | 任何"在代码上下文中定位问题并修复"的需求 |

---

## 前置要求

1. **本地已有目标仓库**（如果没有，先用 `briar-repo` 拉取）
2. **知道目标分支**（MR 的 source_branch，或 pipeline 对应的 branch）
3. **知道修复上下文**（comments 内容 / error logs / diff）

---

## 完整工作流程

### Step 1: 创建 Worktree

使用 `using-git-worktrees` 创建隔离修复环境，或调用：

```bash
briar-repo.sh worktree add <repo-name> <branch>
```

---

### Step 2: 读取修复上下文

在 worktree 中读取所有相关信息：

1. **代码文件**：根据 comments / error logs 定位到具体文件
2. **MR diff**（如果是 review 场景）：
   ```bash
   # 在 worktree 中查看该分支的完整 diff
   git diff origin/<target_branch>..HEAD
   ```
3. **Comments 内容**：从 briar-mr 的 fetch 结果中读取
4. **Pipeline logs**（如果是 pipeline 场景）：从 briar-mr pipeline 的输出中读取失败原因；如果日志不足，使用 `zan-log-query` 或 `error-log-analyzer` 进一步查询天网日志。

---

### Step 3: 分析并修复

逐条分析需要修复的问题：

| 问题类型 | 判断标准 | 操作 |
|---------|---------|------|
| 语法/类型错误 | 明显错误，如 `this` 在函数组件中为 `undefined` | ✅ 修复 |
| 语义不一致 | 变量名、常量值与业务语义不符 | ✅ 修复 |
| 代码简化 | 可用更简洁写法，不影响逻辑 | ✅ 修复 |
| 重复代码 | 多处相同逻辑，可提取公共方法 | ✅ 修复 |
| 异常处理 | 批量操作部分失败的处理 | ✅ 视业务判断 |
| 防御性建议 | 增加错误提示、日志，异常场景极少 | ❌ 跳过（说明原因） |
| 设计争议 | 涉及架构决策，无明确对错 | ❌ 跳过（说明原因） |

**修复原则**：
- 做**最小改动**修复问题，不重构无关代码
- 保持原有代码风格
- 如果一个问题涉及多个文件，全部修完再验证

---

### Step 4: 验证修复

在 worktree 中运行项目验证：

```bash
./scripts/briar-fix.sh verify <worktree_path>
```

脚本会自动检测项目类型并运行对应验证：

| 检测依据 | 运行命令 |
|---------|---------|
| 有 `package.json` + `npx tsc` | `npx tsc --noEmit` |
| 有 `Makefile` + `make lint` | `make lint` |
| 有 `package.json` + `lint` script | `npm run lint` |
| 有 `package.json` + `typecheck` script | `npm run typecheck` |

**验证失败时**：
1. 读取错误日志
2. 定位问题根因
3. 修复后重新验证
4. 循环直到通过

---

### Step 5: 展示 Diff 给用户确认

```bash
./scripts/briar-fix.sh diff <worktree_path>
```

**必须展示给用户看**，不要自动提交。输出格式：

```
=== 修复摘要 ===
文件: src/foo.ts
  - 移除了未使用的 import
  - 将 channelId 改为 DY_LEAD

文件: src/bar.ts
  - 简化了数组去重逻辑

=== 完整 Diff ===
（git diff 输出）
```

> 如果修复内容较多，先展示摘要，用户说"看看详细 diff" 再展示完整 diff。

---

### Step 6: 用户确认后提交

用户说"可以提交"、"提交吧"、"push" 等确认后，执行：

```bash
# 1. 提交
./scripts/briar-fix.sh commit \
  <worktree_path> \
  "fix: 按 review 意见修复"

# 2. Push（如果用户要求）
./scripts/briar-fix.sh push <worktree_path>
```

**提交信息建议**：
- 按 review 修复：`fix: 按 review 意见修复 xxx` / `refactor: 优化 xxx 逻辑`
- Pipeline 修复：`fix: 修复 lint/type 错误` / `fix: 修复 CI 构建失败`

---

### Step 7: 清理 Worktree

提交完成后，立即清理：

```bash
briar-repo.sh worktree remove <repo-name> <branch>
```

> 如果用户说"先不清理，我还要看看"，则推迟清理，但**必须提醒**用户后续手动清理。

---

## 与 briar-mr 的配合

### 在【修复评论】中使用

```
briar-mr fetch（获取 comments）
  ↓
逐条分析合理性
  ↓
需要修复的 → 调用 briar-fix
  │   1. setup worktree（via using-git-worktrees / briar-repo）
  │   2. 读取 comments + diff 上下文
  │   3. 修复代码
  │   4. verify
  │   5. 展示 diff，等用户确认
  │   6. commit + push
  │   7. cleanup（via using-git-worktrees / briar-repo）
  ↓
输出修复总结表格
```

### 在【Pipeline 失败】中使用

```
briar-mr pipeline（获取 pipeline jobs）
  ↓
发现 lint/test/build 失败
  ↓
调用 briar-fix
  │   1. setup worktree（via using-git-worktrees / briar-repo）
  │   2. 读取失败日志，定位问题
  │   3. 修复代码
  │   4. verify（重点验证失败的 job）
  │   5. 展示 diff，等用户确认
  │   6. commit + push
  │   7. cleanup（via using-git-worktrees / briar-repo）
```

---

## 速查

| 阶段 | 脚本命令 |
|------|---------|
| 创建 worktree | `briar-repo.sh worktree add <repo> <branch>` |
| 验证修复 | `briar-fix.sh verify <worktree_path>` |
| 展示 diff | `briar-fix.sh diff <worktree_path>` |
| 提交 | `briar-fix.sh commit <worktree_path> "<msg>"` |
| push | `briar-fix.sh push <worktree_path>` |
| 清理 worktree | `briar-repo.sh worktree remove <repo> <branch>` |
