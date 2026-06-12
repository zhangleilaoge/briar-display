# 日志导出与下载

天网日志支持导出为压缩文件，适合日志量大、需要离线分析或批量 grep 的场景。

## 何时使用

推荐：

- 直接查询返回结果有限或超时
- 需要分析大量日志
- 需要统计 ERROR/WARN 数量
- 需要用 `zcat`、`grep`、`awk` 等命令离线检索

不推荐：

- 只查看少量近期日志
- 需要实时观察最新日志

## 查询导出状态

```bash
briar-skynet.sh export-status --app <app> [options]
```

底层直接请求 OPS 天网接口：

```text
GET https://ops.qima-inc.com/v3/skynet/log/search/export_status/<app>
```

参数：

| 参数 | 必填 | 说明 |
|------|------|------|
| `--app` | 是 | 应用名称 |
| `--bu` | 否 | 业务线：`main` / `fincloud` |
| `--env` | 否 | 环境：`prod` / `qa` / `pre` |
| `--json` | 否 | 输出 JSON |

示例：

```bash
briar-skynet.sh export-status --app scrm-pc --env prod
briar-skynet.sh export-status --app scrm-pc --env prod --json
```

输出字段关注：

- `exportId`：导出任务 ID
- `idc`：机房标识，如 `bd`、`bj5`
- `state`：`PENDING` / `RUNNING` / `DONE` / `FAILED`
- `size`：文件大小
- `downloadUrl`：下载地址，由工具内部使用

## 下载日志

```bash
briar-skynet.sh download --app <app> --export-id <exportId> [options]
```

底层先查询导出状态获取 `downloadUrl`，再直接下载对应 `.gz` 文件。

参数：

| 参数 | 必填 | 说明 |
|------|------|------|
| `--app` | 是 | 应用名称 |
| `--export-id` | 是 | 导出任务 ID |
| `--idc` | 否 | 机房过滤，如 `bd`、`bj5` |
| `--output` | 否 | 输出目录，默认当前目录 |
| `--bu` | 否 | 业务线：`main` / `fincloud` |
| `--env` | 否 | 环境：`prod` / `qa` / `pre` |

示例：

```bash
briar-skynet.sh download --app scrm-pc --export-id <exportId> --idc bd --output /tmp
```

## 离线检索

下载文件通常为 `.gz`：

```bash
zcat scrm-pc_*.gz | grep "分片"
zcat scrm-pc_*.gz | grep -E "ERROR|WARN"
zcat scrm-pc_*.gz | grep "traceId=xxx"
```

统计：

```bash
zcat scrm-pc_*.gz | grep "分片" | wc -l
zcat scrm-pc_*.gz | grep "ERROR" | wc -l
```

多条件过滤：

```bash
zcat scrm-pc_*.gz | grep "分片" | grep "ERROR"
```

## 注意事项

1. 只有 `DONE` 状态的导出任务可以下载。
2. 不指定 `--idc` 时可能下载多个机房文件。
3. 下载日志可能包含敏感业务数据，回复用户时只摘取必要片段。
