---
name: briar-youzan-skynet
description: Skynet（天网）日志排查方法与可靠查询范式，补足 skynet-query 的用法层。覆盖"查不到不等于不存在"的验证手段、大流量应用的窗口切分、以及"消息消费了但下游没有"类事件丢失的链路排查方法论。触发词：天网查不到、日志丢失、埋点丢失、消息没消费、下游没有数据、事件丢失排查。
tags: skynet, youzan-internal, troubleshooting, nsq, tracking
---

# briar-youzan-skynet — Skynet 日志排查方法

与 `skynet-query` 的分工：`skynet-query` 提供查询入口（CLI / Python API）；本技能提供**怎么查才可靠**、**查不到时怎么办**、以及**事件丢失类问题怎么收口**的方法。使用前确保 skynet-query 可用（`~/.kimi-code/user-skills/skynet-query/skynet_query.py`）。

## 一、可靠查询范式

### 1. 先记住默认陷阱：`0 条` 是待证伪的，不是结论

得到 0 条结果时，按顺序排除三个工具层原因，再谈业务结论：

1. **关键词不可检索**。分词器对部分 token 不建索引（含下划线的 eventId、`wx` 开头的 appId、JSON 内的转义字符串都验证过搜不到）。排除方法：用同一条已知存在的日志里的**另一个词**（topic 名、事件名）搜同一时间窗，能搜到才说明窗口和数据在。
2. **DESC + limit 截断**。结果按时间倒序截取，limit 触顶时拿到的只是窗口**末尾**一段。大流量应用（如带 nsq 消费日志的 daemon 应用）一秒可能上百条，分钟级窗口就会截断。排除方法：把窗口切到秒级再查；或者把时间窗上沿压到目标时刻之后一点点。
3. **多词 queryString 不是 AND**。`"事件名 userId"` 这种组合词不保证交集，可能直接返回空。排除方法：永远**单词搜索 + 拿到结果后客户端过滤**。

### 2. 带连字符的应用名走 Python API，不走 CLI

CLI 入口对 `guide-daemon` 这类带连字符的应用名解析有 bug。直接调底层：

```python
import sys
sys.path.insert(0, '/Users/zhanglei/.kimi-code/user-skills/skynet-query')
from skynet_query import SkynetLogQuerier, API_ENDPOINT_SKYNET_LOG_SEARCH
import datetime

q = SkynetLogQuerier()
def ms(s):  # 北京时间字符串 → epoch ms
    dt = datetime.datetime.strptime(s, '%Y-%m-%d %H:%M:%S')
    return int(dt.replace(tzinfo=datetime.timezone(datetime.timedelta(hours=8))).timestamp() * 1000)

payload = {
    'app': 'guide-daemon',                    # 连字符应用名在这里没问题
    'queryString': '单个可检索关键词',
    'timestampBeginMs': ms('2026-09-21 10:44:20'),
    'timestampEndMs':   ms('2026-09-21 10:44:30'),  # 秒级窗口
    'hostname': '', 'direction': 'DESC', 'after': None, 'limit': 200,
}
events = q._request(API_ENDPOINT_SKYNET_LOG_SEARCH, payload).get('logEvents') or []
# 然后客户端过滤： [e for e in events if '11936530' in json.dumps(e, ensure_ascii=False)]
```

注意：响应体的事件列表在**顶层 `logEvents`**，不在 `data` 里。

### 3. 复杂 Python 用 heredoc，不用 `python3 -c "..."`

多层引号嵌套在 `-c` 下极易踩转义坑：

```bash
python3 << 'EOF' 2>&1 | grep -v -i warning
# ... 上面的代码 ...
EOF
```

## 二、事件丢失类问题的排查方法论

适用症状："客户端说报了 / 上游说消费了，但下游表里没有"。

### 1. 先把链路拓扑画全，再谈"丢在哪一环"

看到下游缺数据时，**第一动作不是猜源头，而是确认"我在消费的消息是谁产出的"**。NSQ 链路里常见的隐藏一环是转换层：

```
客户端 → 采集 → topic_A(原始事件) → [转换应用: 校验/丰富/转发] → topic_B(业务消息) → 业务应用消费入库
```

只在"业务应用消费侧"扫不到，就推断"客户端没发"，是典型的漏环错误。正确做法是先列出每一段的可观测点（每个 topic 的消费日志、每个应用的 listener 日志），逐段用同一条消息的标识（internalID、eventId、traceId）去比对它在每一段是否出现。

### 2. "有消费完成日志、没有处理日志" → 去读消费方的 early-return

消费框架（如 NsqAspect 切面）通常只保证打"消费完成/失败"日志，业务 listener 内部的校验丢弃往往是**安静的 early-return**。看到「nsq消息消费完成」但没有后续处理日志时：

1. 拉消费方仓库，读 listener 入口，找所有 `return` 前置校验（字段合法性、开关、白名单、路由）。
2. 找到丢弃日志的特征词（如"消息内容不合法"），拿消息的 **internalID** 回去搜这个词——能对上即实锤丢在哪个校验。
3. 注意同一条消息可能被多个 channel / listener 各消费一次（internalID 不同），要对每一对都验证。

### 3. 对照样本要有"可比性"

证明"A 有 B 没有"之前，先确认 A 和 B 走的是**同一条代码路径**。同一个事件名，sdkType 不同（js / weapp）、入口容器不同（H5 直开 / 小程序 webview）、版本不同，埋点字段构成都可能不同。选对照样本时把这些维度对齐，否则"别人有数据"什么也证明不了。

### 4. 埋点字段缺失的定位套路

消息体里同一个身份出现在多处（顶层字段、eventParams、context），**消费方只认其中一处**。字段缺失时：

1. 对比正常消息与异常消息的 key 集合差异（排序后 diff），缺哪些键一目了然；
2. 缺键 = 上报端 SDK/集成版本旧，缺值 = 宿主运行时没注入（登录态、全局对象）；
3. 顺着客户端 SDK 代码确认"顶层字段从哪个 API 取"（如 weapp-log-sdk 的顶层 userId 来自 `setLoginSign`/`setBizInfo`，即 `user.li`/`yzUid`），就能区分是"没调"还是"调了但拿到空"。

## 三、收口要求

排查结论必须满足：

- 每一段链路的判断都有日志或代码证据，标注应用名、时间戳、internalID/traceId；
- "没有"的结论都经过第一节的证伪流程（窗口、关键词可检索性、截断）；
- 丢失点定位到具体代码位置（文件:行号）与具体校验条件，不停留在"可能被过滤"。
