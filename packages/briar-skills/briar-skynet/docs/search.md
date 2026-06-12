# search

查询天网日志，支持应用日志检索、traceId 链路追踪与关键字定位。

## 使用场景

- 查询应用线上、预发或测试环境日志
- 查询最近一段时间的 ERROR / WARN 日志
- 通过 traceId 追踪完整调用链
- 按关键字搜索日志内容
- 排查特定时间段的异常

## 命令

```bash
briar-skynet.sh search [options]
```

底层直接请求 OPS 天网接口：

```text
POST https://ops.qima-inc.com/v3/skynet/log/search/search
```

## 参数

| 参数 | 必填 | 说明 | 默认值 |
| --- | --- | --- | --- |
| `--bu` | 否 | 业务线：`main` / `fincloud` | `main` |
| `--env` | 否 | 环境：`prod` / `qa` / `pre` | `prod` |
| `--app` | 否 | 应用名；按 traceId 查询时可省略 | - |
| `--hostname` | 否 | 主机名过滤 | - |
| `--level` | 否 | 日志级别：`ERROR`, `WARN`, `INFO`, `DEBUG`，可逗号分隔 | - |
| `--trace-id` | 否 | 按 traceId 过滤 | - |
| `--thread` | 否 | 按线程名过滤 | - |
| `--query` | 否 | 关键字搜索，如 `kdtId=123`、`分片` | - |
| `--begin` | 否 | 开始时间：毫秒时间戳、ISO 字符串或相对时间 | 最近 1 小时 |
| `--end` | 否 | 结束时间：毫秒时间戳、ISO 字符串或相对时间 | 当前时间 |
| `--limit` | 否 | 返回条数 | `20` |
| `--direction` | 否 | 排序方向：`DESC` / `ASC` | `DESC` |
| `--after` | 否 | 分页游标 | - |
| `--json` | 否 | 输出 JSON 格式 | `false` |

## 时间格式

`--begin` 和 `--end` 支持：

- 毫秒时间戳：`1700000000000`
- ISO 时间字符串：`2024-01-01T00:00:00`
- 相对时间：`-10m`、`-1h`、`-1d`、`-7d`

时间范围最多 7 天。

## 示例

### 查询 scrm-pc 最近 10 分钟线上包含“分片”的日志

```bash
briar-skynet.sh search --app scrm-pc --env prod --query "分片" --begin -10m --limit 20
```

### 查询最近 1 小时 ERROR 日志

```bash
briar-skynet.sh search --app scrm-pc --env prod --level ERROR --begin -1h --limit 20
```

### 通过 traceId 追踪调用链

```bash
briar-skynet.sh search --trace-id yz7-abc123 --begin -1h --limit 50
```

### 查询金融云应用日志

```bash
briar-skynet.sh search --bu fincloud --app your-app --env prod --level ERROR
```

### 输出 JSON

```bash
briar-skynet.sh search --app scrm-pc --query "分片" --begin -10m --json
```

## 返回关注点

回复用户时优先总结：

- 命中数量和时间范围
- 典型日志的时间、级别、主机、traceId
- 关键错误信息或异常堆栈摘要
- 是否需要扩大时间范围、换关键字或导出分析

## 注意事项

1. OPS 天网搜索接口当前可匿名查询部分日志；如果接口返回未登录或权限不足，可传 `--cookie`，或在 `~/.config/briar-skills/.env` 配置 `BRIAR_SKYNET_COOKIE`，或复用 `~/.cache/zan-cli/auth/ops.qima-inc.com.cookies`。
2. 金融域应用需要设置 `--bu fincloud`，否则可能返回应用不存在。
3. 结果有分页游标 `after` 时，可带 `--after` 继续查询下一页。
4. 日志量很大或查询超时时，改用导出下载流程。
