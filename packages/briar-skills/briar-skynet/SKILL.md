---
name: briar-skynet
description: >
  天网日志查询工具。用于应用日志检索、traceId 链路追踪、关键字定位和日志导出下载。
  触发场景：用户需要查线上/预发/测试日志、查报错、分析 traceId、排查 ERROR 或定位异常调用链。
---

# briar-skynet: 天网日志查询工具

## 概述

本 skill 直接调用天网 OPS 接口，用于查询天网应用日志、按 traceId 追踪调用链，以及在日志量较大时导出下载日志文件离线分析。

| 能力 | 说明 |
|------|------|
| 日志查询 | 按应用、环境、级别、traceId、线程、关键字和时间范围查询日志 |
| 链路追踪 | 通过 traceId 查询同一请求链路相关日志 |
| 导出状态 | 查看天网日志导出任务状态 |
| 下载日志 | 下载已完成导出的 `.gz` 日志文件 |

---

## 行为索引

| 行为 | 触发关键词 | 文档 | 命令 |
|------|-----------|------|------|
| 查询日志 | “查日志”、“查线上日志”、“查报错”、“最近 N 分钟”、“关键字” | [docs/search.md](docs/search.md) | `briar-skynet.sh search ...` |
| traceId 追踪 | “分析 traceId”、“查链路”、“调用链” | [docs/search.md](docs/search.md) | `briar-skynet.sh search --trace-id ...` |
| 导出状态 | “导出日志状态”、“看看导出任务” | [docs/export.md](docs/export.md) | `briar-skynet.sh export-status ...` |
| 下载导出 | “下载日志”、“下载导出文件” | [docs/export.md](docs/export.md) | `briar-skynet.sh download ...` |

---

## 使用原则

1. **先直接查询**：默认使用 `search`，限制返回条数，快速判断是否有结果。
2. **时间范围要明确**：用户说“最近 10 分钟”时，传 `--begin -10m`；未指定时默认使用工具的最近 1 小时。
3. **线上环境默认 prod**：用户说“线上”时使用 `--env prod`；预发用 `pre`，测试用 `qa`。
4. **日志量大再导出**：直接查询结果过多、超时或需要离线统计时，改用导出/下载流程。
5. **结果要筛选后再回复**：不要把大量原始日志完整贴回，优先总结命中数量、典型日志、时间、主机、traceId 和错误信息。

---

## 凭证与依赖

`briar-skynet` 不依赖 `zan-cli`，脚本直接请求：

```text
https://ops.qima-inc.com/v3/skynet/log/search
```

运行依赖：`bash`、`curl`、`python3`。

OPS 天网搜索接口当前可匿名查询部分日志；如果接口返回未登录或权限不足，再提供 `ops.qima-inc.com` 登录态 cookie。读取优先级：

1. 命令行参数：`--cookie "key=value; key2=value2"`
2. 环境变量或 `~/.config/briar-skills/.env`：`BRIAR_SKYNET_COOKIE="key=value; key2=value2"`
3. 复用已有 zan-cli 登录态文件：`~/.cache/zan-cli/auth/ops.qima-inc.com.cookies`

可选配置：

```bash
BRIAR_SKYNET_COOKIE="key=value; key2=value2"
BRIAR_SKYNET_COOKIE_FILE="$HOME/.cache/zan-cli/auth/ops.qima-inc.com.cookies"
```

> 该 skill 不保存天网账号密码，不持久化日志查询结果。下载日志时仅写入用户指定的输出目录。

---

## 常用命令

### 查询应用最近 10 分钟包含关键字的线上日志

```bash
briar-skynet.sh search --app scrm-pc --env prod --query "分片" --begin -10m --limit 20
```

### 查询应用 ERROR 日志

```bash
briar-skynet.sh search --app scrm-pc --env prod --level ERROR --begin -1h --limit 20
```

### 通过 traceId 追踪链路

```bash
briar-skynet.sh search --trace-id yz7-xxx --begin -1h --limit 50
```

### JSON 输出，便于后续处理

```bash
briar-skynet.sh search --app scrm-pc --query "分片" --begin -10m --json
```

---

## 文档读取指引

- 用户要查日志、查报错、按关键字检索、查 traceId：读取 [docs/search.md](docs/search.md)。
- 用户要导出、下载、离线 grep：读取 [docs/export.md](docs/export.md)。
- 单次查询不充分时，可先 `search` 评估，再用 `export-status` / `download` 辅助分析。
