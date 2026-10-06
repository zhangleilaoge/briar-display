# 全球板块

首页「全球板块」入口：A股 / 港股 / 美股 / 日本 / 韩国的大盘指数与板块涨跌（红涨绿跌，所有市场统一）。免登录（与工具箱同为 `PUBLIC_PREFIXES`），API 走 `API_PUBLIC_PREFIXES: /api/markets/`。

- 页面：`/briar/markets`（五市场卡片）、`/briar/markets/{cn|hk|us|jp|kr}`（热力图 + 列表、行业/概念切换、排序切换）
- API：`GET /api/markets/overview`、`GET /api/markets/:market/sectors?kind=industry|concept&level=1|2`（level 仅 A股行业：申万一级/二级）
- 代码：后端 `packages/briar-node/src/services/market/`（http / cache / session / catalog / sources / marketService）+ `routes/markets.ts`；共享类型 `briar-shared/src/markets.ts`；前端 `components/markets/`
- 前端不直连任何第三方，全部经 briar-node 代理

## 数据源（2026-10 实测，均国内直连可达）

| 市场 | 板块 | 列表 | 排序维度 | 实时性 | 指数 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| A股 | 腾讯 `proxy.finance.qq.com/cgi/cgi-bin/rank/pt/getRank?board_type=hy\|hy2\|gn`（申万一级 31 / 二级 124 / 概念 ~800），失败兜底东财 push2 clist（`fs=m:90+t:2\|t:3`） | 动态 | 涨跌幅 / 成交额 / 主力净流入 / 换手率 | 实时 | 东财 ulist（上证/深成/创业板/科创50），兜底腾讯 qt |
| 港股 | 东财 ulist 恒生综合行业指数 `124.HSCI*`（12 个） | 固定代理 | 涨跌幅 / 成交额 | 实时 | 东财 ulist（恒指/恒生科技/国企） |
| 美股 | 腾讯 qt `usXLK…`（11 个 SPDR 行业 ETF + 29 个细分/主题 ETF），兜底东财 ulist `105/106/107.*` | 固定代理 | 涨跌幅 / 成交额（USD） | 实时 | 东财 ulist（SPX/纳指综合/道指） |
| 日本 | Naver `polling.finance.naver.com/api/realtime/worldstock/stock/1617.T,…`（TOPIX-17 行业 ETF，NEXT FUNDS 1617–1633） | 固定代理 | 涨跌幅 / 成交额（JPY） | **延迟 15 分钟** | 日经 225 东财 ulist；TOPIX Naver（延迟 15 分钟） |
| 韩国 | Naver `m.stock.naver.com/api/stocks/industry\|theme?page=&pageSize=100`（业种 79 / 主题 ~264） | 动态 | 仅涨跌幅（源无成交额） | 实时 | Naver polling `domestic/index/KOSPI,KOSDAQ,KPI200` |

为什么港美日是固定代理：国内可达的源（东财/腾讯/新浪）都没有港股、美股的板块聚合接口（新浪美股/港股分类只返回成分股），日本 Kabutan 有 AWS WAF 验证码、Yahoo JP 无可用接口。接口里 `listMode: 'fixed-proxy'` + `proxyNote`，页面显示紫色标签（如「以 SPDR 行业 ETF 代理」）。韩国业种名用 `catalog.ts` 的 `KR_INDUSTRY_ZH` 翻成中文（`rawName` 保留韩文），主题名无翻译、原样显示。

请求细节：

- 东财 push2：`Referer: https://quote.eastmoney.com/`，UTF-8 JSON；clist `pz` 上限 100；**同 IP 短时间几十次 clist 就会被封（Empty reply，波及子域）**，所以只做兜底；ulist.np 不受影响
- 腾讯 getRank：UTF-8 JSON，无需 Referer，`count` ≤ 200，成交额/主力净流入单位万元
- 腾讯 qt.gtimg.cn：**GBK**，`~` 分隔（[3] 现价 [30] 时间 [32] 涨跌幅 [37] 成交额）；港股指数约 15 分钟延迟（只在东财指数失败时兜底，届时标「延迟」）
- Naver：UTF-8 JSON，带 `Referer: https://m.stock.naver.com/`；`pageSize` 上限 100，越界页返回 404（已按「本页不满 / 凑够 totalCount」停止翻页）
- 统一 UA（`http.ts`），超时 8s

## 缓存与轮询

- 内存缓存 `cache.ts`：按 key（`sectors:{market}:{kind}:{level}` / `indices:em|naver`）TTL + 单飞；上游失败返回旧值并带 `stale: true` + `error`，失败后 10s 冷却期内不再撞上游；从未成功过才 502
- TTL 按交易时段：交易中 15s / 午休与盘前 60s / 收盘 5min；前端轮询 `session.pollMs`：20s / 60s / 5min，页面隐藏暂停
- 交易时段按各市场当地时区判断（含午休，美股自动处理夏令时）；节假日无日历，靠「最新行情日期 ≠ 当地今天 → 休市」推断（开盘头 30 分钟不判，以免早盘还没成交时误判）
- 所有时间展示为北京时间

## 代理

`BRIAR_MARKET_PROXY`（如 `http://127.0.0.1:7890`）：直连失败（超时/HTTP 错误/空响应）时用 undici ProxyAgent 再试一次；不配只直连。服务器在国内，目前所有源直连可达，代理只是兜底。

## 已知限制

- 日本 ETF 15 分钟延迟，且部分 TOPIX-17 ETF 成交清淡，涨跌幅可能与行业指数有偏差
- 韩国主题名为韩文（无稳定翻译源）
- 东财 clist 有封 IP 风险（只做 A股兜底）
- 节假日只靠行情日期推断；美股指数（东财）收盘后无法确认是否有延迟，按实时标注
- 每次轮询都经过 logger 写入 `request_logs`（公开接口，访问量大时注意表增长）
