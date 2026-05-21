# 获取 Pipeline（pipeline）

**触发条件**：用户说"看看 pipeline"、"CI 怎么样"、"构建状态"、"检查构建结果"。

**只做一件事**：获取 MR 关联的 Pipeline 信息和各 Job 的执行状态。

---

## API

```bash
export GITLAB_TOKEN=$(grep GITLAB_TOKEN /Users/zhanglei/Documents/projects/briar-display/packages/briar-skills/.env | cut -d= -f2-)
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
./packages/briar-skills/briar-mr/scripts/briar-mr-pipeline.sh <domain> <project_path> <mr_iid>
# 或
./packages/briar-skills/briar-mr/scripts/briar-mr.sh pipeline <domain> <project_path> <mr_iid>
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
