/**
 * 全球板块（/briar/markets）前后端共享的市场定义与接口类型
 * 数据源与缓存策略见 docs/global-sectors.md
 */

/** 市场 ID：A股 / 港股 / 美股 / 日本 / 韩国 */
export const MARKET_IDS = ['cn', 'hk', 'us', 'jp', 'kr'] as const
export type MarketId = (typeof MARKET_IDS)[number]

export const MARKET_LABELS: Record<MarketId, string> = {
	cn: 'A股',
	hk: '港股',
	us: '美股',
	jp: '日本',
	kr: '韩国',
}

export const isMarketId = (value: string): value is MarketId =>
	(MARKET_IDS as readonly string[]).includes(value)

/** 板块类别：行业 / 概念（主题） */
export type SectorKind = 'industry' | 'concept'

/** 可排序的「热度」维度；数据源没有的字段不会出现在 sortKeys 里 */
export type SectorSortKey = 'changePct' | 'amount' | 'netInflow' | 'turnoverRate'

/** 交易状态（按当地时间 + 最近行情日期判断，含午休） */
export type MarketSessionStatus = 'pre' | 'open' | 'break' | 'closed'

/** 板块清单来源：dynamic = 每次从数据源实时拉取清单；fixed-proxy = 固定代理列表（如行业 ETF） */
export type SectorListMode = 'dynamic' | 'fixed-proxy'

export interface MarketIndexQuote {
	code: string
	name: string
	price: number | null
	changePct: number | null
	change: number | null
	/** 行情时间（毫秒时间戳），上游没给则为 null */
	quoteTime: number | null
	/** 行情延迟分钟数，0 = 实时 */
	delayMinutes: number
	/** 大盘资金流（拿不到时不返回）：A股主力净流入、韩国外资/机构净买入 */
	flows?: IndexFlow[]
}

export interface IndexFlow {
	/** 口径：主力净流入 / 外资净买入 / 机构净买入 */
	label: string
	/** 正数流入（净买入），负数流出（净卖出），单位为当地货币元 */
	value: number
	currency: string
}

export interface SectorItem {
	code: string
	name: string
	/** 原始名称（翻译过的韩国板块保留韩文原名） */
	rawName?: string
	price: number | null
	changePct: number | null
	/** 成交额（元 / 当地货币，见 amountCurrency） */
	amount: number | null
	/** 资金净流入（当地货币元，正流入负流出；口径见 MarketSectorsResponse.netInflowBasis） */
	netInflow: number | null
	/** 换手率 % */
	turnoverRate: number | null
	upCount: number | null
	downCount: number | null
	total: number | null
	leader: { name: string; code?: string; changePct: number | null } | null
}

export interface MarketSessionInfo {
	status: MarketSessionStatus
	/** 当地时区（IANA） */
	timeZone: string
	/** 交易时段描述（当地时间） */
	sessionText: string
	/** 建议的前端轮询间隔（毫秒） */
	pollMs: number
}

/** 统一的缓存/降级元信息 */
export interface MarketDataMeta {
	/** 后端成功拉取上游的时间（毫秒） */
	fetchedAt: number
	/** true = 上游失败，返回的是最近一次缓存 */
	stale: boolean
	/** stale 时的上游错误摘要 */
	error?: string
}

export interface MarketOverviewItem extends MarketDataMeta {
	market: MarketId
	label: string
	session: MarketSessionInfo
	indices: MarketIndexQuote[]
	/** 最近行情时间（取指数里最新的 quoteTime） */
	quoteTime: number | null
	/** 指数行情延迟说明，空串 = 实时 */
	delayNote: string
	sources: string[]
}

export interface MarketOverviewResponse {
	markets: MarketOverviewItem[]
}

export interface SectorKindOption {
	kind: SectorKind
	label: string
	/** 子分级（目前仅 A股行业：申万一级 / 二级） */
	levels?: { value: string; label: string }[]
}

export interface MarketSectorsResponse extends MarketDataMeta {
	market: MarketId
	kind: SectorKind
	level?: string
	kinds: SectorKindOption[]
	items: SectorItem[]
	sortKeys: SectorSortKey[]
	listMode: SectorListMode
	/** 固定代理时的说明，例如「以行业 ETF 代理」 */
	proxyNote?: string
	source: string
	realtime: boolean
	delayMinutes: number
	/** 成交额币种 */
	amountCurrency: string
	/** 净流入口径（如「主力净流入（超大单+大单）」），该市场/类别没有资金流数据时为 null */
	netInflowBasis: string | null
	session: MarketSessionInfo
	quoteTime: number | null
}

// ───────────────────────── 当日分时 ─────────────────────────

/** 分时点：[毫秒时间戳, 价格] */
export type TrendPoint = [number, number]

export interface TrendSeries {
	code: string
	name: string
	/** 昨收（基准线）；数据源没给时为 null */
	prevClose: number | null
	points: TrendPoint[]
	/** 该交易日的连续竞价时段（毫秒时间戳区间，按当地时间算，含午休断开） */
	sessions: [number, number][]
	/** 交易日（当地日期 YYYY-MM-DD），无数据时为 null */
	tradeDate: string | null
	delayMinutes: number
	source: string
}

export interface MarketIndexTrendsResponse extends MarketDataMeta {
	market: MarketId
	timeZone: string
	items: TrendSeries[]
	session: MarketSessionInfo
}

/** 走势面板周期：分时 / 五日 / 日K / 周K / 月K */
export type ChartPeriod = 'intraday' | '5day' | 'day' | 'week' | 'month'
export type ChartTarget = 'index' | 'sector'
export const CHART_PERIODS: ChartPeriod[] = ['intraday', '5day', 'day', 'week', 'month']
export const CHART_PERIOD_LABELS: Record<ChartPeriod, string> = {
	intraday: '分时',
	'5day': '五日',
	day: '日K',
	week: '周K',
	month: '月K',
}

export function isChartPeriod(value: string): value is ChartPeriod {
	return (CHART_PERIODS as string[]).includes(value)
}

/** 分时点：[毫秒时间戳, 价格, 该分钟成交量（无量数据为 null）] */
export type MinutePoint = [number, number, number | null]

export interface MinuteDay {
	/** 当地交易日 YYYY-MM-DD */
	date: string
	prevClose: number | null
	/** 该交易日连续竞价时段（毫秒时间戳区间，含午休断开） */
	sessions: [number, number][]
	points: MinutePoint[]
}

/** K 线：[YYYY-MM-DD, 开, 高, 低, 收, 成交量（无量数据为 null）] */
export type Candle = [string, number, number, number, number, number | null]

export interface ChartPeriodSupport {
	period: ChartPeriod
	available: boolean
	/** 不可用原因（前端 tab 置灰后的提示） */
	reason?: string
}

export interface MarketChartResponse extends MarketDataMeta {
	market: MarketId
	target: ChartTarget
	code: string
	name: string
	period: ChartPeriod
	timeZone: string
	/** 该标的各周期是否有数据源 */
	periods: ChartPeriodSupport[]
	/** 当前周期是否可用；false 时 reason 给出原因 */
	available: boolean
	reason?: string
	/** 分时 / 五日：基准线（五日为首日昨收） */
	prevClose: number | null
	/** 分时（1 天）/ 五日（≤5 天），K 线周期为空数组 */
	days: MinuteDay[]
	/** 日K / 周K / 月K（前复权），分时周期为空数组 */
	candles: Candle[]
	delayMinutes: number
	source: string
	session: MarketSessionInfo
}
