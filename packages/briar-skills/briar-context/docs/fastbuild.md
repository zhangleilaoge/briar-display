# 获取 Fastbuild 打包现场

**触发条件**：用户给出 fastbuild 任务链接（URL 匹配 `fastbuild..*/webui/task/<id>`，如 `https://fastbuild.qima-inc.com/webui/task/691188/log`），要求"看看打包结果"、"构建为什么失败"。

---

## 获取方式：opscli（推荐）

**不需要进页面**。`opscli fastbuild` 直连 fastbuild 服务，直接拿任务状态和构建日志：

```bash
TASK_ID=691188   # 从 URL /webui/task/<id> 中提取

# 任务状态：状态（成功/失败）、仓库、分支、commit、构建命令
opscli fastbuild status $TASK_ID

# 构建日志（末尾 300 行，失败堆栈通常在末尾）
opscli fastbuild log $TASK_ID | tail -300

# 需要更早的日志时翻页
opscli fastbuild log $TASK_ID -o <offset>
```

**前置要求**：
- 已安装 `opscli`（`which opscli`）
- 已执行过 `opscli login`（直连模式凭证失效时重新 login）

---

## 降级：opscli 不可用 → 内网页面抓取

`opscli` 未安装或查询失败时，降级为通用内网页面流程（macOS Playwright + Chrome cookie → AppleScript fallback），见 [generic.md](generic.md)。`briar-context.sh` 会自动处理该降级。

---

## 输出结构

`briar-context.sh` 会把**完整日志先落盘**到本地文件，避免大日志撑爆上下文：

```
【Fastbuild 任务上下文】<task_id>

--- 任务状态 ---
任务ID / 状态 / 仓库 / 分支 / Commit / 命令

--- 构建日志 ---
完整日志已保存: ${TMPDIR}/briar-context-fastbuild-<task_id>.log（共 N 行）
# N ≤ 300：内联输出全部日志
# N > 300：只内联末尾 80 行，提示用 Read 工具读取文件（可用 offset 翻页）
```

## 下游使用建议

- **briar-fix**：根据「仓库 + 分支 + commit」定位代码，根据日志末尾的错误堆栈定位失败原因（typecheck、lint、构建 OOM 等）。
- 日志末尾通常足以定位失败；若错误在更前面（如安装依赖阶段失败），直接 Read 落盘的日志文件（`offset` 翻页），或执行 `opscli fastbuild log <task_id> -o <offset>`。

---

## 注意事项

1. **URL 变体**：`/webui/task/691188` 和 `/webui/task/691188/log` 均可识别，提取的是 task 后的数字
2. **发布单模式**：`opscli fb log --ticket <deploy_ticket_id>` 走 OPS 平台 node_build 接口，适用于发布单场景；本 skill 默认直连模式
3. **其他常用命令**：`opscli fb last-success`（最近一次成功构建的 commit）、`opscli fb repos`（搜索仓库）、`opscli fb cancel`（取消任务）
