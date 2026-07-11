# 获取 Pipeline（pipeline）

**触发条件**：用户说"看看 pipeline"、"CI 怎么样"、"构建状态"、"检查构建结果"。

**只做一件事**：获取 MR 关联的 Pipeline 信息和各 Job 的执行状态。

---

## API

```bash
# 读取 GITLAB_TOKEN：优先环境变量 → 全局配置
if [ -z "$GITLAB_TOKEN" ]; then
    ENV_FILE="$HOME/.config/briar-skills/.env"
    if [ -f "$ENV_FILE" ]; then
        export GITLAB_TOKEN=$(grep GITLAB_TOKEN "$ENV_FILE" | cut -d= -f2-)
    fi
fi

ENCODED_PATH=$(echo "$PROJECT_PATH" | sed 's/\//%2F/g')

# 获取 MR 详情中的 head_pipeline
curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "https://$DOMAIN/api/v4/projects/$ENCODED_PATH/merge_requests/$MR_IID" | jq '.head_pipeline'

# 获取 Pipeline 的 Jobs
curl -s --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
  "https://$DOMAIN/api/v4/projects/$ENCODED_PATH/pipelines/$PIPELINE_ID/jobs"
```

或通过脚本：

```bash
./scripts/briar-mr-pipeline.sh <domain> <project_path> <mr_iid>
# 或
./scripts/briar-mr.sh pipeline <domain> <project_path> <mr_iid>
```

---

## 输出格式

整理成清晰的表格展示：

| Job 名称 | Stage | 状态 | 耗时 | 失败原因 |
|---------|-------|------|------|---------|
| lint | lint | ❌ failed | 283s | - |
| test | test | ✅ passed | 45s | - |
| build | build | ⏳ running | - | - |

同时展示 Pipeline 总体信息：状态、耗时、链接。

---

## Pipeline 失败后的代码修复

如果 Pipeline 中有 `lint`、`test`、`build` 等 Job 失败，通常需要修复代码后重新触发。

**代码修复由 briar-fix 处理**，流程如下：

```
briar-mr pipeline（获取失败日志）
  ↓
分析失败原因（lint 错误 / 类型错误 / 测试失败）
  ↓
调用 briar-fix
  │   1. setup worktree（基于 pipeline 对应分支）
  │   2. 读取失败日志，定位问题文件
  │   3. 修复代码
  │   4. verify（重点验证失败的 job）
  │   5. 展示 diff，等用户确认
  │   6. commit + push
  │   7. cleanup worktree（via using-git-worktrees）
  ↓
重新触发 pipeline（用户手动或自动）
```

详见 [briar-fix 文档](../../briar-fix/SKILL.md)。

### 修复脚本速查

```bash
# 创建 worktree：调用 using-git-worktrees skill
# 清理 worktree：调用 using-git-worktrees skill

# 验证（会自动检测项目类型运行 lint/typecheck）
../../briar-fix/scripts/briar-fix.sh verify <worktree_path>

# 用户确认后提交
../../briar-fix/scripts/briar-fix.sh commit <worktree_path> "fix: 修复 CI 失败"
../../briar-fix/scripts/briar-fix.sh push <worktree_path>
```
