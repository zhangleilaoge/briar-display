---
name: briar-get-session-id
description: 按时间窗口 + （定制页面 key 或 kdtId）查询有效导购登录 sessionId。通过 columbus 白名单解析定制页面商家，从 uic-session 天网日志提取 C 端 H5 登录候选并按 userId 去重，再用 zan-dubbo-invoke 以不超过 3 QPS 调用生产只读 Dubbo 接口校验导购身份，返回手机号、userId、sessionId 和登录时间。当用户提到有效导购登录信息、导购 SessionKey、导购 sessionId、模拟导购登录、定制页面商家导购、按页面 key 找店铺导购，或需要复现“模拟导购登录：获取SessionKey”流程时，应使用本技能。
tags: python, dubbo, youzan-internal, retail, session
---

# briar-get-session-id — 有效导购 SessionId 查询

## 技能执行前置说明

每次技能执行前，必须执行以下命令（位于当前技能目录）：

```bash
bash scripts/pre-execute.sh briar-get-session-id
```

这是强制命令，AI 不得跳过。若脚本输出检测到新版本并完成自动更新，在本次技能结束回复中明确告知用户。

## 注意事项

- 本技能仅限开发人员在已获授权的排查场景中临时使用，不得操作用户数据，不得频繁调用。
- 本技能只负责查询日志和校验导购身份，不自动写入 `KDTSESSIONID`，不执行模拟登录，也不修改用户或店铺数据。
- 只使用 C 端 H5 登录记录。小程序、App 或 B 端登录记录不能用于该场景，应直接排除。
- 天网查询只替换目标 `kdtId` 和时间范围，保留 `"sourceType":"H5"` 条件；总部和分店 ID 均可作为查询目标。
- `sessionId` 等同于可用于登录的敏感凭据，只能按最小必要原则展示和保存；执行进度不得打印完整值，详细结果文件权限必须为 `0600`。
- 如果用户在本技能之外人工使用 `sessionId` 模拟登录，应尽量减少页面浏览和点击，避免产生埋点并影响用户行为分析统计。

## 必填参数

用户必须提供以下两类条件：

1. **时间窗口**：`--window-hours`，默认 24 小时，最大 168 小时（天网日志只保留最近 7 天，超出无意义）。
2. **店铺条件**，二选一：
   - `--kdt-id <KDT_ID>`：直接指定店铺。拒绝空值、非数字、零或负数。
   - `--page-key <定制页面key>`：如 `guide-customer-detail-page`。脚本通过 columbus 白名单解析出所有绑定该 key 的店铺，按顺序逐店查询，找到预期数量的有效记录或尝试满 `--max-shops`（默认 3）家后停止。

可选参数：`--expected-valid-count`（预期有效记录数，默认 2，正整数）。

## 执行流程

1. 确认用户已提供时间窗口和店铺条件（kdtId 或定制页面 key）。
2. 确认查询已获授权。
3. 阅读 [dependencies.md](references/dependencies.md)，检查全部运行时依赖。
4. 阅读 [privacy.md](references/privacy.md)，遵守全部隐私规则。
5. 执行 `zan-log-query` 和 `zan-dubbo-invoke` 的前置检查（脚本自动执行）。
6. 在技能目录中执行查询脚本（推荐用 `uv` 提供 Python 3.12 与依赖）：

```bash
# 按 kdtId 查询
uv run --system-certs --python 3.12 --with requests --with browser_cookie3 \
  --with truststore \
  scripts/query_user_sessions.py \
  --kdt-id <KDT_ID> \
  --window-hours 24 \
  --output-dir <安全输出目录> \
  --expected-valid-count 2

# 按定制页面 key 查询（自动解析白名单店铺，逐店尝试）
uv run --system-certs --python 3.12 --with requests --with browser_cookie3 \
  --with truststore \
  scripts/query_user_sessions.py \
  --page-key guide-customer-detail-page \
  --window-hours 48 \
  --max-shops 3 \
  --output-dir <安全输出目录> \
  --expected-valid-count 1
```

没有 `uv` 时使用自带依赖的 Python 3.10+ 解释器直接执行 `scripts/query_user_sessions.py`；通过 `--zan-dubbo-python <PYTHON解释器>` 或 `ZAN_DUBBO_PYTHON` 指定可导入 `requests`/`browser_cookie3` 的解释器。查询过程中不得自动安装依赖。

脚本固定执行以下规则：

- 天网应用：`uic-session`；环境和业务线：`prod` / `main`
- 关键字：`<kdtId> "sourceType":"H5"`；候选按 `userId` 去重，不设上限
- 白名单：`https://columbus.prod.qima-inc.com/columbus/getWhiteList`，使用本机 Chrome CAS 会话拉取，只提取 `<pageKey>_<kdtId>` 条目，不落盘原始响应
- 店铺元数据和导购 RPC：通过 `zan-dubbo-invoke` 在 `prod` 串行执行，相邻请求启动时间至少间隔 350 毫秒
- 重试：最多重试一次并退避，重试也必须经过限流器
- 本地锁：同一台机器同一时间只允许一个流程执行
- 实时进度：只打印脱敏标识
- 文件权限：脱敏请求记录和详细结果文件均使用 `0600`

不得绕过限流器。预期有效记录数越大，可能产生的 Dubbo 请求越多；结果中需同时说明预期数量和实际校验候选数。

## Dubbo 依赖与鉴权

两个只读 RPC 都必须通过 `zan-dubbo-invoke/scripts/dubbo_query.py` 在 `prod` 环境执行，不得直接调用旧版导购 HTTP 网关：

- `com.youzan.shopcenter.shop.service.ShopMetaReadService.queryShopMetaInfo`
- `com.youzan.guide.api.service.shoppingguide.ShoppingGuideReadApiService.getShoppingGuide`

Dubbo 鉴权由 `zan-dubbo-invoke` 管理（Funeng/Ticket 登录态，可从 Chrome CAS 会话刷新）。不得在对话中接收凭据，不得自行维护第二份凭据缓存。天网鉴权由 `zan-log-query` 和 `opscli` 管理。

## 结果判定

- 当任一店铺 `logQuery.truncated=true` 时，结果覆盖不完整。必须说明结果只基于天网最新返回的候选，不能视为全窗口完整扫描。
- Dubbo 调用成功但没有返回导购对象时，应判定为“不是有效导购”，而不是请求失败。
- 当 `targetReached=false` 时，应说明“已校验全部可用候选（或已尝试满 max-shops 家店铺），但未找到预期数量”。如果天网结果已截断，不得声称截断范围之外不存在更多有效记录。
- 不得根据返回内容推导额外业务结论。

## 输出规范

执行过程只打印进度数量，不打印完整手机号、User ID、Session ID、traceId、头像地址或凭据。

当用户明确要求展示有效登录记录时，最终使用以下格式：

| 手机号 | User ID | Session ID | 时间 | kdtId |
|---|---:|---|---|---:|
| `<mobile>` | `<userId>` | `<sessionId>` | `<logTime>` | `<kdtId>` |

提供详细结果文件和脱敏请求记录文件的路径；存在截断时必须说明。没有有效记录时，只汇报数量，不暴露无效候选数据。

## 失败处理

- OPS 登录缺失或过期：请用户执行 `opscli login` 后重试。
- 缺少 `zan-dubbo-invoke`：请用户安装后重试（如 `helm skill install zan-dubbo-invoke -g`）。
- Dubbo 鉴权失败：停止执行，请用户在 Chrome 登录 CAS（cas.qima-inc.com）并手动访问 https://ticket.qima-inc.com 完成 Ticket 平台登录后重试；鉴权错误不得重试。
- 白名单拉取失败（401/302 到 safelogin）：请用户在 Chrome 登录 CAS 后重试。
- 遇到限流：至少退避一秒，所有重试仍需遵守 3 QPS 限制。
- 部分候选失败：保留已完成的脱敏记录，汇报失败数量，不得伪造结果。
- 输出目录不安全：拒绝 `/`、用户主目录或系统目录。
