# 行情（原「全球板块」）

首页「全球板块」入口卡片保留不变；进入后面包屑 / 页面标题 / 文档标题统一叫「行情」（2026-10 起：板块之外还有成分股、个股详情和自选股）。A股 / 港股 / 美股 / 日本 / 韩国的大盘指数与板块涨跌（红涨绿跌，所有市场统一）。免登录（与工具箱同为 `PUBLIC_PREFIXES`），API 走 `API_PUBLIC_PREFIXES: /api/markets/`。

- 页面：`/briar/markets`（五市场卡片 + 自选股 + 个股搜索）、`/briar/markets/{cn|hk|us|jp|kr}`（热力图 + 列表、行业/概念切换、排序切换）
- API：`GET /api/markets/overview`、`GET /api/markets/:market/sectors?kind=industry|concept&level=1|2`（level 仅 A股行业：申万一级/二级）、`GET /api/markets/:market/index-trends`（指数卡片分时小图）、`GET /api/markets/:market/chart?target=index|sector&code=…&period=intraday|5day|day|week|month`（走势面板）
- 个股 API：`GET /api/markets/:market/constituents?code=&kind=`（板块成分股）、`GET /api/markets/:market/stock?code=`（个股报价）、`GET /api/markets/:market/chart?target=stock&code=…`（个股走势）、`GET /api/markets/search?q=`（跨市场搜索）、`GET /api/markets/quotes?items=cn:sh600519,us:AAPL`（批量报价，自选列表用）、`GET|POST /api/markets/watchlist`、`DELETE /api/markets/watchlist/:market/:code`
- 代码：后端 `packages/briar-node/src/services/market/`（http / cache / session / catalog / sources / curated（题材板块聚合）/ marketService / trendSources / trendService / stockSources / stockService / watchlist）+ `routes/markets.ts` + `dal/marketWatchlistDal.ts`；共享类型 `briar-shared/src/markets.ts`；前端 `components/markets/`（详情弹窗 `MarketDetailDialog` + 导航栈 `dialogStack`、走势 `MarketChartPanel`(`ChartPanelBody`) + `TrendChart`、成分股 `SectorConstituents`、个股 `StockDetailView`、自选 `WatchlistCard` / `watchlistStore`）
- 前端不直连任何第三方，全部经 briar-node 代理

## 数据源（2026-10 实测，均国内直连可达）

| 市场 | 板块 | 列表 | 排序维度 | 实时性 | 指数 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| A股 | 腾讯 `proxy.finance.qq.com/cgi/cgi-bin/rank/pt/getRank?board_type=hy\|hy2\|gn`（申万一级 31 / 二级 124 / 概念 ~800），失败兜底东财 push2 clist（`fs=m:90+t:2\|t:3`） | 动态 | 涨跌幅 / 成交额 / 主力净流入 / 换手率 | 实时 | 东财 ulist（上证/深成/创业板/科创50），兜底腾讯 qt |
| 港股 | 行业：东财 ulist 恒生综合行业指数 `124.HSCI*`（12 个）；概念：`CONCEPT_SECTORS.hk` 人工维护题材名单（16 个），腾讯报价聚合 | 固定代理 / 人工维护 | 涨跌幅 / 成交额 | 行业指数实时；概念 15 分钟延迟 | 东财 ulist（恒指/恒生科技/国企） |
| 美股 | 行业：腾讯 qt `usXLK…`（11 个 SPDR 行业 ETF），兜底东财 ulist `105/106/107.*`；概念：`CONCEPT_SECTORS.us` 人工维护题材名单（23 个），腾讯报价聚合 | 固定代理 / 人工维护 | 涨跌幅 / 成交额（USD） | 腾讯 ETF 报价**延迟 15 分钟**（分时接口 qt 标 `delay`）；东财兜底实时 | 东财 ulist（SPX/纳指综合/道指） |
| 日本 | Naver `polling.finance.naver.com/api/realtime/worldstock/stock/1617.T,…`（TOPIX-17 行业 ETF，NEXT FUNDS 1617–1633） | 固定代理 | 涨跌幅 / 成交额（JPY） | **延迟 15 分钟** | 日经 225 东财 ulist；TOPIX Naver（延迟 15 分钟） |
| 韩国 | Naver `m.stock.naver.com/api/stocks/industry\|theme?page=&pageSize=100`（业种 79 / 主题 ~264） | 动态 | 仅涨跌幅（源无成交额） | 实时 | Naver polling `domestic/index/KOSPI,KOSDAQ,KPI200` |

为什么港美日是固定代理 / 人工维护：国内可达的源（东财/腾讯/新浪）都没有港股、美股的板块聚合接口（新浪美股/港股分类只返回成分股），日本 Kabutan 有 AWS WAF 验证码、Yahoo JP 无可用接口。接口里 `listMode: 'fixed-proxy' | 'curated'` + `proxyNote`，页面显示紫色标签。韩国业种名用 `catalog.ts` 的 `KR_INDUSTRY_ZH` 翻成中文（`rawName` 保留韩文），主题名无翻译、原样显示。

**港股 / 美股概念 tab（curated，2026-10 起）**：免费源没有港美股的题材板块接口，换成 `catalog.ts` 的 `CONCEPT_SECTORS` 人工维护名单（美股 23 个：存储、光模块/CPO、AI 算力、半导体设备、机器人、创新药、中概互联网、核能/铀、加密货币概念、量子计算等；港股 16 个：中概互联网、创新药、新消费、内房、银行、博彩等）。行情全部来自腾讯 qt 批量报价后聚合：涨跌幅 = 有报价成分股的**等权平均**（保留两位）、成交额 = 求和、涨跌家数与领涨股直接统计；名单即成分股，点开即个股详情。成员跨板块重叠的报价只请求一次（单市场一个缓存条目 `curated:quotes:{market}`）。名单是静态数据，新热点需手工收录（改 catalog 后随部署生效）；某个成员停市/摘牌时该板块聚合自动按有报价的部分计算，成分股列表里该成员字段留空。

请求细节：

- 东财 push2：`Referer: https://quote.eastmoney.com/`，UTF-8 JSON；clist `pz` 上限 100；**同 IP 短时间几十次 clist 就会被封（Empty reply，波及子域）**，所以只做兜底；ulist.np 不受影响
- 腾讯 getRank：UTF-8 JSON，无需 Referer，`count` ≤ 200，成交额/主力净流入单位万元
- 腾讯 qt.gtimg.cn：**GBK**，`~` 分隔（[3] 现价 [30] 时间 [32] 涨跌幅 [37] 成交额）；港股指数约 15 分钟延迟（只在东财指数失败时兜底，届时标「延迟」）
- Naver：UTF-8 JSON，带 `Referer: https://m.stock.naver.com/`；`pageSize` 上限 100，越界页返回 404（已按「本页不满 / 凑够 totalCount」停止翻页）
- 统一 UA（`http.ts`），超时 8s

## 排序

上方「按 xx」下拉、方向按钮和列表表头共用一份排序状态（`MarketSectorsPage` 的 `sortKey/direction`），热力图按同一顺序展示；轮询刷新只换数据，不重置排序。表头点新列先降序，再点同列切升序，当前列用箭头标方向。维度：涨跌幅 / 净流入 / 成交额 / 换手率（后端 `sortKeys`，有数据才出现）+ 涨跌家数（按上涨家数 / 成分股总数的占比）/ 领涨股涨幅 / 板块名称（`Intl.Collator('zh-CN')`）。没有数据的列不可点、不进下拉；空值无论升降序都排最后。当前市场没有所选维度时临时按涨跌幅排，切回有该字段的市场恢复。

## 资金流（净流入）

列表在「涨跌幅」和「成交额」之间固定一列「净流入」（正数红 = 流入，负数绿 = 流出，单位万/亿，币种同成交额），表头小字 + tooltip 写口径；热力图色块最后一行「流入 +3.20亿 / 流出 -1.10亿」。接口 `MarketSectorsResponse.netInflowBasis` 给口径，没有资金流时为 null，前端该列显示「—」，`sortKeys` 里也不会有 `netInflow`（排序选项自动隐藏）。

| 市场 | 板块净流入 | 口径 | 大盘（指数卡片） |
| :--- | :--- | :--- | :--- |
| A股 | 腾讯 getRank `zljlr`（万元→元）；兜底东财 clist `f62` | 主力净流入（超大单+大单净额） | 东财 ulist `f62` 主力净流入（与指数报价同一请求，无额外请求） |
| 港股 | 无（东财 ulist 恒生行业指数 `f62` 为 `-`） | — | 无（恒指等 `f62` 为 `-`） |
| 美股 | 东财 ulist `f62`（腾讯 qt 无资金流，单独一次 ulist 补，`flows:us:{kind}` 缓存 ≥60s，失败不显示） | 主力净流入（东财按大单估算，ETF 二级市场成交，非申购赎回） | 无（SPX 等 `f62` 为 `-`） |
| 日本 | 无（Naver 无资金流；东财不覆盖东证 ETF） | — | 无 |
| 韩国 | 无（Naver 业种/主题接口只有涨跌幅和涨跌家数） | — | Naver `m.stock.naver.com/api/index/{KOSPI\|KOSDAQ\|KPI200}/trend` 外资净买入 / 机构净买入（억원→KRW，缓存 ≥60s） |

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
- 缓存：分时 / 五日同报价（20s / 60s / 5min）；K 线交易中 60s、午休盘前 5min、收盘后 30min。指数分时与卡片小图共用 `trends:index:{market}` 缓存

## 板块详情弹窗：成分股 → 个股（导航栈）

板块弹窗在走势面板下面列成分股；点某只股票在**同一个弹窗**里压栈打开个股详情（标题换成股票名 + 代码，左上「返回 板块名」回到板块，栈逻辑在 `dialogStack.ts`：同一只重复点不重复压栈，点栈里已有的层截回那一层）。自选列表和搜索结果打开的是只有一层的个股弹窗。

成分股表：名称/代码、现价、涨跌幅、净流入（仅有资金流的源）、成交额、换手率、总市值、市盈率；表头排序与板块列表同一套（`nextSort`：新列先降序，同列切升序，箭头标方向，空值永远最后，名称按 `zh-CN` 排序）。默认按涨跌幅降序，前端每页 50 行（「再显示 50 只 / 显示全部 / 收起」），轮询节奏同板块。

| 市场 | 成分股来源 | 上限 | 字段 | 延迟 |
| :--- | :--- | :--- | :--- | :--- |
| A股（腾讯 `pt01*`/`pt02*` 板块） | 腾讯 `proxy.finance.qq.com/cgi/cgi-bin/rank/pt/getBoardRankList?board_code=…&sort_type=priceRatio`（`count` ≤ 200） | ≤ 400 全取；超过（如大概念上千只）取涨幅前 200 + 跌幅前 200，表下注明 | 现价 / 涨跌幅 / 成交额 / 换手率 / 总市值 / 市盈率（TTM）；**无个股净流入** | 实时 |
| A股（东财兜底时的 `BK*` 板块） | 东财 clist `fs=b:BKxxxx`，每页 100 | 涨幅前 400 | 另有主力净流入（`f62`）、市盈率（动态） | 实时；**每页占一次东财全局限流（6 次/分钟）**，缓存 ≥ 30s |
| 韩国业种 / 主题 | Naver `m.stock.naver.com/api/stocks/{industry\|theme}/{no}?pageSize=100` | 前 400 | 现价 / 涨跌幅 / 成交额（KRW）/ 总市值 | 实时 |
| 美股行业（SPDR ETF 板块） | 纳斯达克筛选器 `api.nasdaq.com/api/screener/stocks?sector=GICS行业名`（`limit=100` 翻页，剔除权证/优先股等杂项）+ 腾讯 qt 批量补报价 | 前 400（如金融 1648 只，注明截断） | 现价 / 涨跌幅 / 成交额 / 换手率 / 总市值 / 市盈率；中文名取腾讯 | 15 分钟 |
| 港股 / 美股概念（curated） | 板块名单即成分股（`CONCEPT_SECTORS`），腾讯 qt 报价 | 全名单（每板块 3–10 只） | 同上 | 15 分钟 |
| 港股恒生综合行业 | — 不支持：恒指公司成分股只向授权机构提供，无免费公开源 | | | |
| 美股 / 日本行业 ETF、日本概念 | — 不支持：ETF 持仓没有免费实时源 | | | |

不支持时接口 `available: false` + `reason`，弹窗显示空状态和原因。

## 个股详情

报价头（现价、涨跌额/幅、实时/延迟、行情时间、今开/最高/最低/昨收/成交额/成交量/换手率/总市值/市盈率/市净率）+ 与板块同一个走势面板（`target=stock`）+「加自选 / 已自选」按钮。

| 市场 | 代码格式 | 报价 | 分时 | 五日 | 日/周/月K | 延迟 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| A股 | `sh600519` / `sz000001` / `bj8xxxxx` | 腾讯 qt（PE 动态、PB、市值） | 腾讯 `minute/query` | 腾讯 `day/query` | 腾讯 `newfqkline`（前复权） | 实时 |
| 港股 | `00700` | 腾讯 qt `hk00700` | 腾讯 `minute/query` | 腾讯 `day/query` | 腾讯 `newfqkline` | 15 分钟 |
| 美股 | `AAPL`（大写） | 腾讯 qt `usAAPL` | 腾讯 `UsMinute/query` | 腾讯 `dayus/query` | 腾讯 `newfqkline`（代码带交易所后缀，取自 qt） | 15 分钟 |
| 日本 | `7203` | Naver `api.stock.naver.com/stock/{code}.T/basic`（英文名、PER/PBR/市值） | Naver `pricesByPeriod` | — 无 | Naver `chart/foreign/item/{code}.T/…` | 15 分钟 |
| 韩国 | `005930` | Naver polling `domestic/stock` + integration（PER/PBR，缓存 10 分钟） | Naver `chart/domestic/item/{code}/minute`（裁掉 NXT 08:00–20:00 盘外段，只留 KRX 正规时段） | 同接口取多日 | Naver `chart/domestic/item/{code}/{day,week,month}` | 实时 |

## 自选股与搜索

`/briar/markets` 市场卡片下方「自选股」卡片：搜索框 + 自选列表（名称、市场、代码、现价、涨跌幅红涨绿跌、移除按钮；点行打开个股弹窗）。列表用 `/quotes` 批量报价，按 `pollMs` 轮询（交易中约 20s），页面隐藏暂停。上限 100 只（`WATCHLIST_LIMIT`）。

- **存储**：登录用户存服务端表 `market_watchlist`（`user_id + market + code` 唯一，随用户删除级联），多设备同步；未登录存 `localStorage`（`briar_market_watchlist`），登录后首次打开把本机自选合并进账号再清掉本地。与「媒体历史」同一模式。`/briar/markets` 本身免登录，所以不能强制登录。
- `GET /watchlist` 在公开前缀下（GET 不过 authMiddleware），路由里自行用 Bearer / `briar_token` cookie 校验，未登录 401；`POST` / `DELETE` 走 authMiddleware，已在 `apiPermissions.ts` 声明（登录即可）
- **搜索**：搜全部个股（不限自选），代码 / 名称 / 拼音首字母。前端输入防抖 300ms，新输入会 abort 旧请求；后端按规范化后的查询词缓存 10 分钟（`search:{q}`，单飞）。来源：腾讯 smartbox `smartbox.gtimg.cn/s3/?t=all&q=`（A股个股+ETF、港股、美股，支持 `gzmt` 这类拼音首字母）+ Naver 自动补全 `ac.stock.naver.com/ac?target=stock`（韩国、日本；纯中文查询不打 Naver）。结果代码完全匹配的排最前，去重后最多 30 条。
- 缓存 key：`constituents:{market}:{kind}:{code}`、`stock:quote:{market}:{code}`、`stock:quotes:{tencent|kr|jp}:{ids}`、`stock:valuation:kr:{code}`、`chart:{market}:stock:{code}:{period}`、`search:{q}`；报价 / 成分股 TTL 同板块（交易中 20s / 午休盘前 60s / 收盘 5min），东财方案 ≥ 30s

## 缓存与轮询

- 进程内全局共享缓存 `cache.ts`（所有用户共用一份）：key = 市场 + 接口类型 + 参数——`indices:em|naver|kr-flows`（overview）、`sectors:{market}:{kind}:{level}`、`flows:us:{kind}`、`trends:index:{market}`（index-trends 与面板分时共用）、`chart:{market}:{target}:{code}:{period}`
- 单飞：同一 key 过期时只有第一个请求打上游，其余并发请求 await 同一个 in-flight Promise（`pending` Map），成功失败都在 `finally` 里删掉，失败不会锁死；上游失败返回旧值并带 `stale: true` + `error`，失败后 10s 冷却期内直接回旧值不再撞上游，冷却期过后下一次请求重新打上游；从未成功过直接 502（不设冷却，下次请求立刻重试）
- 上限：LRU，`BRIAR_MARKET_CACHE_MAX`（默认 500，限定 50–5000）；每 60s 清理「过期超过 1 小时」的条目（保留 1 小时是为了上游挂掉时还能回旧值），定时器 `unref()`
- TTL 按交易时段：交易中 `BRIAR_MARKET_CACHE_TTL_SECONDS`（默认 20s，限定 15–30s）/ 午休与盘前 60s / 收盘 5min；K 线交易中 60s / 午休盘前 5min / 收盘 30min；东财方案至少 30s，资金流附加数据至少 60s。前端轮询 `session.pollMs`：20s / 60s / 5min，页面隐藏暂停
- 交易时段按各市场当地时区判断（含午休，美股自动处理夏令时）；节假日无日历，靠「最新行情日期 ≠ 当地今天 → 休市」推断（开盘头 30 分钟不判，以免早盘还没成交时误判）
- 所有时间展示为北京时间

## 代理

`BRIAR_MARKET_PROXY`（如 `http://127.0.0.1:7890`）：直连失败（超时/HTTP 错误/空响应）时用 undici ProxyAgent 再试一次；不配只直连。服务器在国内，目前所有源直连可达，代理只是兜底。

## 已知限制

- 日本 ETF 15 分钟延迟，且部分 TOPIX-17 ETF 成交清淡，涨跌幅可能与行业指数有偏差；日本没有五日分时
- 韩国业种 / 主题没有任何走势数据；港股行业走势依赖东财（限流 6 次/分钟，偶发「请求过于频繁」）；**港美股概念板块（curated）没有任何走势数据**（人工维护成分股组合，无对应指数，点开各周期 tab 显示原因）
- 韩国主题名为韩文（无稳定翻译源）
- 东财 clist 有封 IP 风险（只做 A股兜底）
- 节假日只靠行情日期推断；美股指数（东财）收盘后无法确认是否有延迟，按实时标注
- 成分股：港股恒生行业、日本 ETF 仍不支持（见上）；港美股概念板块名单是人工维护的静态数据（有滞后，新热点需改 catalog）；美股行业按 GICS 行业口径，与 SPDR ETF 实际持仓略有差异；A股腾讯源没有个股净流入；大板块只展示 400 只
- 个股：日本没有五日分时；港股 / 美股 / 日股报价延迟 15 分钟；美股只有常规时段（无盘前盘后）
- 搜索：日韩个股依赖 Naver 自动补全（中文名搜不到日韩股，需用代码 / 英文 / 韩文）；只收股票（A股另含 ETF），不含基金、债券、期权、期货
- 每次轮询都经过 logger 写入 `request_logs`（公开接口，访问量大时注意表增长）
