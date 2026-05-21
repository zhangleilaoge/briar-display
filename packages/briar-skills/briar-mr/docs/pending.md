# 列出未回复评论（pending）

**触发条件**：用户说"看看我最近的 MR 有哪些评论没回"、"待回复评论"、"最近 MR 评论"、"pending comments"。

**核心能力**：自动查询当前用户最近 N 天创建的 **open 状态** MR，筛选出他人发表的、**需要作者回复的实质性人工评论**，排除系统自动消息和标记性评论。

> 与【获取评论】的区别：本行为**不需要 MR 链接**，自动搜索用户的 MR；而 fetch 需要明确的 MR 链接。

---

## 前置要求

- `GITLAB_TOKEN` 已配置（见 [SKILL.md](../SKILL.md) 的 Token 管理）
- 无需用户提供任何 MR 链接

---

## 参数（智能识别，顺序无关）

```bash
./briar-mr-pending.sh [domain] [days] [project_filter]
# 或
./briar-mr.sh pending [domain] [days] [project_filter]
```

脚本会**自动识别**参数类型：

| 参数类型 | 识别规则 | 示例 | 默认值 |
|---------|---------|------|--------|
| `domain` | 包含 `.` 的字符串 | `gitlab.qima-inc.com` | `gitlab.qima-inc.com` |
| `days` | 纯数字 | `7`、`30` | `30` |
| `project_filter` | 其他字符串，模糊匹配 `project_path` | `scrm-mono`、`ma-front` | 空（匹配全部） |

### 调用示例

```bash
# 默认：最近 30 天，全部仓库
./briar-mr-pending.sh

# 最近 7 天，全部仓库
./briar-mr-pending.sh 7

# 最近 30 天，scrm-mono 仓库（模糊匹配）
./briar-mr-pending.sh scrm-mono

# 最近 7 天，scrm-mono 仓库
./briar-mr-pending.sh 7 scrm-mono

# 完整参数：指定 domain + 天数 + 仓库
./briar-mr-pending.sh gitlab.qima-inc.com 7 scrm-mono
```

---

## 过滤规则

只保留同时满足以下条件的评论：

| 条件 | 说明 |
|------|------|
| MR 状态为 `opened` | 自动过滤 merged/closed 的 MR |
| 仓库匹配（如有指定） | `project_path` 包含 `project_filter`（不区分大小写） |
| 他人发起 | 排除自己发起的 discussion |
| 用户未回复 | discussion 的后续 notes 中没有当前用户的回复 |
| 排除系统消息 | `approved`、`mentioned in commit`、`automatic merge`、机器人消息等 |
| 排除标记性评论 | 以"已阅"开头的阶段性 review 标记 |
| 排除纯赞成 | `LGTM`、`👍`、`好的`、`approved` 等无实质问题的短评论 |

---

## 输出格式

```
========================================
  未回复评论汇总
  用户: xxx (@xxx)
  范围: 最近 30 天 open 状态的 MR，仓库: *scrm-mono*
========================================

---
📋 !4849 | fe/scrm-mono
   分支: feat/xxx → master
   标题: feat(pc-frontend): ...
   链接: https://gitlab.../merge_requests/4849
   未回复评论 (2条):
  ❗ 戴泓: 这里的逻辑可以简化一下...
  ❗ lihangyu: channelId 语义不一致，建议改为...

========================================
⚠️  共 2 条未回复实质性评论（检查了 3 个 MR）
========================================
```
