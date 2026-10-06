# 全球板块

首页「全球板块」入口：A股 / 港股 / 美股 / 日本 / 韩国的大盘指数与板块涨跌（红涨绿跌，所有市场统一）。免登录（与工具箱同为 `PUBLIC_PREFIXES`），API 走 `API_PUBLIC_PREFIXES: /api/markets/`。

- 页面：`/briar/markets`（五市场卡片）、`/briar/markets/{cn|hk|us|jp|kr}`（热力图 + 列表、行业/概念切换、排序切换）
- API：`GET /api/markets/overview`、`GET /api/markets/:market/sectors?kind=industry|concept&level=1|2`（level 仅 A股行业：申万一级/二级）、`GET /api/markets/:market/index-trends`（指数卡片分时小图）、`GET /api/markets/:market/chart?target=index|sector&code=…&period=intraday|5day|day|week|month`（走势面板）
- 代码：后端 `packages/briar-node/src/services/market/`（http / cache / session / catalog / sources / marketService / trendSources / trendService）+ `routes/markets.ts`；共享类型 `briar-shared/src/markets.ts`；前端 `components/markets/`（走势面板 `MarketChartPanel` + `TrendChart`）
- 前端不直连任何第三方，全部经 briar-node 代理

## 数据源（2026-10 实测，均国内直连可达）

| 市场 | 板块 | 列表 | 排序维度 | 实时性 | 指数 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| A股 | 腾讯 `proxy.finance.qq.com/cgi/cgi-bin/rank/pt/getRank?board_type=hy\|hy2\|gn`（申万一级 31 / 二级 124 / 概念 ~800），失败兜底东财 push2 clist（`fs=m:90+t:2\|t:3`） | 动态 | 涨跌幅 / 成交额 / 主力净流入 / 换手率 | 实时 | 东财 ulist（上证/深成/创业板/科创50），兜底腾讯 qt |
| 港股 | 东财 ulist 恒生综合行业指数 `124.HSCI*`（12 个） | 固定代理 | 涨跌幅 / 成交额 | 实时 | 东财 ulist（恒指/恒生科技/国企） |
| 美股 | 腾讯 qt `usXLK…`（11 个 SPDR 行业 ETF + 29 个细分/主题 ETF），兜底东财 ulist `105/106/107.*` | 固定代理 | 涨跌幅 / 成交额（USD） | 腾讯 ETF 报价**延迟 15 分钟**（分时接口 qt 标 `delay`）；东财兜底实时 | 东财 ulist（SPX/纳指综合/道指） |
| 日本 | Naver `polling.finance.naver.com/api/realtime/worldstock/stock/1617.T,…`（TOPIX-17 行业 ETF，NEXT FUNDS 1617–1633） | 固定代理 | 涨跌幅 / 成交额（JPY） | **延迟 15 分钟** | 日经 225 东财 ulist；TOPIX Naver（延迟 15 分钟） |
| 韩国 | Naver `m.stock.naver.com/api/stocks/industry\|theme?page=&pageSize=100`（业种 79 / 主题 ~264） | 动态 | 仅涨跌幅（源无成交额） | 实时 | Naver polling `domestic/index/KOSPI,KOSDAQ,KPI200` |

为什么港美日是固定代理：国内可达的源（东财/腾讯/新浪）都没有港股、美股的板块聚合接口（新浪美股/港股分类只返回成分股），日本 Kabutan 有 AWS WAF 验证码、Yahoo JP 无可用接口。接口里 `listMode: 'fixed-proxy'` + `proxyNote`，页面显示紫色标签（如「以 SPDR 行业 ETF 代理」）。韩国业种名用 `catalog.ts` 的 `KR_INDUSTRY_ZH` 翻成中文（`rawName` 保留韩文），主题名无翻译、原样显示。

请求细节：

- 东财 push2：`Referer: https://quote.eastmoney.com/`，UTF-8 JSON；clist `pz` 上限 100；**同 IP 短时间几十次 clist 就会被封（Empty reply，波及子域）**，所以只做兜底；ulist.np 不受影响
- 腾讯 getRank：UTF-8 JSON，无需 Referer，`count` ≤ 200，成交额/主力净流入单位万元
- 腾讯 qt.gtimg.cn：**GBK**，`~` 分隔（[3] 现价 [30] 时间 [32] 涨跌幅 [37] 成交额）；港股指数约 15 分钟延迟（只在东财指数失败时兜底，届时标「延迟」）
- Naver：UTF-8 JSON，带 `Referer: https://m.stock.naver.com/`；`pageSize` 上限 100，越界页返回 404（已按「本页不满 / 凑够 totalCount」停止翻页）
- 统一 UA（`http.ts`），超时 8s

## 走势面板（分时 / 五日 / 日K / 周K / 月K）

点详情页的指数卡片、热力图色块或列表行，打开同一个面板（`lightweight-charts`，打开面板时才动态加载）。分时 / 五日 = 基准线面积图（昨收为基准，红上绿下，纵轴以昨收对称）+ 每分钟成交量；日 / 周 / 月 K = 蜡烛（前复权）+ 成交量 + MA5 / MA10 / MA20，可拖动、双指缩放。横轴是当地交易时段，午休和隔夜被压缩，当天未走完的分钟留白。没有数据源的周期 tab 置灰，点开显示原因（接口 `periods[].available/reason`）。

| 市场 | 标的 | 分时 | 五日 | 日/周/月K | 延迟 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| A股 | 指数 | 腾讯 `minute/query`（兜底东财 trends2） | 腾讯 `day/query` | 腾讯 `newfqkline` | 实时 |
| A股 | 板块（腾讯 pt01/pt02） | 腾讯 `minute/query` | 腾讯 `day/query` | 腾讯 `newfqkline`（旧 `fqkline` 对板块只回 1 根） | 实时 |
| A股 | 板块（东财兜底时的 BK） | 东财 trends2 | 东财 trends2 `ndays=5` | 东财 kline | 实时 |
| 港股 | 指数 | 腾讯 `minute/query`（兜底东财） | 腾讯 `day/query` | 腾讯 `newfqkline` | 实时 |
| 港股 | 恒生行业 `HSCI*` | 东财 trends2 | 东财 trends2 `ndays=5` | 东财 kline `klt=101/102/103&fqt=1` | 实时（腾讯/新浪/Naver 均无 HSCI 走势，只能东财，受限流） |
| 美股 | 指数 | 腾讯 `UsMinute/query`（兜底东财） | 腾讯 `dayus/query` | 腾讯 `newfqkline`（代码 `us.INX`） | 实时 |
| 美股 | ETF | 腾讯 `UsMinute/query`（兜底东财） | 腾讯 `dayus/query` | 腾讯 `newfqkline`（代码要带交易所后缀 `usXLK.AM`，取 qt 第 3 段并缓存） | 15 分钟 |
| 日本 | 指数 | Naver `front-api/chart/pricesByPeriod` | — 无（Naver 外国 minute 为空） | Naver `chart/foreign/index/{code}/{day,week,month}` | 15 分钟 |
| 日本 | TOPIX-17 ETF | Naver `pricesByPeriod`（成交稀疏，缺的分钟用上一笔补） | — 无 | Naver `chart/foreign/item/{code}.T/…` | 15 分钟 |
| 韩国 | 指数 | Naver `chart/domestic/index/{code}/minute` | 同接口带 `startDateTime/endDateTime` 取多日 | Naver `chart/domestic/index/{code}/{day,week,month}` | 实时 |
| 韩国 | 业种 / 主题 | — 无 | — 无 | — 无（Naver 业种/主题无走势接口） | — |

- 腾讯 / Naver 日本的成交量是当日累计，后端转成每分钟量；Naver 韩国、东财是每分钟量
- 五日：每天带自己的昨收（腾讯 `prec`；Naver/东财用前一天最后一笔；东财 `ndays=5` 的 preClose 是最新一天的，首日昨收留空、以首笔为基准），面板基准线为首日昨收
- 东财 push2his（trends2 + kline）进程内全局限流 **6 次/分钟**，超限直接报「请求过于频繁」；东财方案缓存至少 30s。实测同 IP 秒级连发十几次就会被 Empty reply 封，且会连带 ulist（港股行业列表）一起封
- 缓存：分时 / 五日同报价（15s / 60s / 5min）；K 线交易中 60s、午休盘前 5min、收盘后 30min。指数分时与卡片小图共用 `trends:index:{market}` 缓存

## 缓存与轮询

- 内存缓存 `cache.ts`：按 key（`sectors:{market}:{kind}:{level}` / `indices:em|naver`）TTL + 单飞；上游失败返回旧值并带 `stale: true` + `error`，失败后 10s 冷却期内不再撞上游；从未成功过才 502
- TTL 按交易时段：交易中 15s / 午休与盘前 60s / 收盘 5min；前端轮询 `session.pollMs`：20s / 60s / 5min，页面隐藏暂停
- 交易时段按各市场当地时区判断（含午休，美股自动处理夏令时）；节假日无日历，靠「最新行情日期 ≠ 当地今天 → 休市」推断（开盘头 30 分钟不判，以免早盘还没成交时误判）
- 所有时间展示为北京时间

## 代理

`BRIAR_MARKET_PROXY`（如 `http://127.0.0.1:7890`）：直连失败（超时/HTTP 错误/空响应）时用 undici ProxyAgent 再试一次；不配只直连。服务器在国内，目前所有源直连可达，代理只是兜底。

## 已知限制

- 日本 ETF 15 分钟延迟，且部分 TOPIX-17 ETF 成交清淡，涨跌幅可能与行业指数有偏差；日本没有五日分时
- 韩国业种 / 主题没有任何走势数据；港股行业走势依赖东财（限流 6 次/分钟，偶发「请求过于频繁」）
- 韩国主题名为韩文（无稳定翻译源）
- 东财 clist 有封 IP 风险（只做 A股兜底）
- 节假日只靠行情日期推断；美股指数（东财）收盘后无法确认是否有延迟，按实时标注
- 每次轮询都经过 logger 写入 `request_logs`（公开接口，访问量大时注意表增长）
