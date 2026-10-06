import {
	MARKET_IDS,
	MARKET_LABELS,
	type MarketId,
	type MarketOverviewItem,
	type MarketOverviewResponse,
	type MarketSectorsResponse,
	type SectorItem,
	type SectorKind,
	type SectorKindOption,
	type SectorListMode,
	type SectorSortKey,
} from '@briar/shared'
import { type CachedResult, cachedLoad } from './cache'
import {
	HK_INDUSTRY_INDICES,
	JP_TOPIX17_ETFS,
	KR_INDUSTRY_ZH,
	MARKET_INDICES,
	type ProxyDef,
	US_SECTOR_ETFS,
	US_THEME_ETFS,
} from './catalog'
import { CACHE_TTL_MS, getSessionInfo, getSessionStatus } from './session'
import {
	type QuoteRow,
	fetchEastmoneyBoards,
	fetchEastmoneyUlist,
	fetchNaverGroups,
	fetchNaverPolling,
	fetchTencentBoards,
	fetchTencentQt,
	toIndexQuote,
} from './sources'

/** 参数错误（路由层转 400） */
export class MarketInputError extends Error {}

const ttlFor = (markets: MarketId[]) =>
	Math.min(...markets.map((m) => CACHE_TTL_MS[getSessionStatus(m, Date.now())]))

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err))

// ───────────────────────── 大盘指数 ─────────────────────────

interface IndexBundle {
	rows: Record<string, QuoteRow>
	source: string
}

const allIndexDefs = MARKET_IDS.flatMap((m) => MARKET_INDICES[m])

/** 东财 ulist 一次拉全部市场指数；失败用腾讯 qt 兜底（日韩指数腾讯没有，靠 Naver） */
async function loadEmIndexBundle(): Promise<IndexBundle> {
	const secids = allIndexDefs.flatMap((d) => (d.em ? [d.em] : []))
	try {
		const rows = await fetchEastmoneyUlist(secids)
		return { rows: Object.fromEntries(rows.map((r) => [r.key, r])), source: '东方财富 ulist' }
	} catch (err) {
		console.warn('[markets] 东财指数失败，改用腾讯 qt:', errorMessage(err))
		const defs = allIndexDefs.filter((d) => d.em && d.tencent)
		const qtRows = await fetchTencentQt(defs.map((d) => d.tencent as string))
		const byKey = Object.fromEntries(qtRows.map((r) => [r.key, r]))
		const rows: Record<string, QuoteRow> = {}
		for (const d of defs) {
			const row = byKey[d.tencent as string]
			if (row && d.em) rows[d.em] = row
		}
		return { rows, source: '腾讯行情 qt' }
	}
}

/** Naver：韩国指数（实时）+ 日本 TOPIX / 日经（15 分钟延迟） */
async function loadNaverIndexBundle(): Promise<IndexBundle> {
	const domestic = allIndexDefs.flatMap((d) => (d.naver?.kind === 'domestic' ? [d.naver.code] : []))
	const world = allIndexDefs.flatMap((d) => (d.naver?.kind === 'world' ? [d.naver.code] : []))
	const settled = await Promise.allSettled([
		fetchNaverPolling('domestic/index', domestic),
		fetchNaverPolling('worldstock/index', world),
	])
	const rows = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []))
	if (rows.length === 0) {
		const reasons = settled.map((s) => (s.status === 'rejected' ? errorMessage(s.reason) : ''))
		throw new Error(reasons.filter(Boolean).join('; ') || 'naver: empty')
	}
	return { rows: Object.fromEntries(rows.map((r) => [r.key, r])), source: 'Naver 证券' }
}

type Settled<T> = { ok: true; result: CachedResult<T> } | { ok: false; error: string }

const settle = async <T>(p: Promise<CachedResult<T>>): Promise<Settled<T>> =>
	p.then(
		(result) => ({ ok: true as const, result }),
		(err) => ({ ok: false as const, error: errorMessage(err) }),
	)

async function getIndexBundles() {
	const [em, naver] = await Promise.all([
		settle(cachedLoad('indices:em', ttlFor(['cn', 'hk', 'us', 'jp', 'kr']), loadEmIndexBundle)),
		settle(cachedLoad('indices:naver', ttlFor(['jp', 'kr']), loadNaverIndexBundle)),
	])
	return { em, naver }
}

function buildOverviewItem(
	market: MarketId,
	bundles: Awaited<ReturnType<typeof getIndexBundles>>,
	now: number,
): MarketOverviewItem {
	const indices = []
	const sources = new Set<string>()
	const errors = new Set<string>()
	let stale = false
	let fetchedAt = 0
	const use = (b: Settled<IndexBundle>) => {
		if (!b.ok) return
		sources.add(b.result.value.source)
		fetchedAt = Math.max(fetchedAt, b.result.fetchedAt)
		if (b.result.stale) {
			stale = true
			if (b.result.error) errors.add(b.result.error)
		}
	}
	for (const def of MARKET_INDICES[market]) {
		const emRow = def.em && bundles.em.ok ? bundles.em.result.value.rows[def.em] : undefined
		const naverRow =
			def.naver && bundles.naver.ok ? bundles.naver.result.value.rows[def.naver.code] : undefined
		// 韩国优先 Naver（交易所直连实时）；其余优先东财（实时），Naver 只补东财没有的（如 TOPIX）
		const preferNaver = def.naver?.kind === 'domestic'
		const row = preferNaver ? (naverRow ?? emRow) : (emRow ?? naverRow)
		if (!row) continue
		use(row === emRow ? bundles.em : bundles.naver)
		indices.push(toIndexQuote(row, def.name))
	}
	if (indices.length === 0) {
		if (!bundles.em.ok) errors.add(bundles.em.error)
		if (!bundles.naver.ok) errors.add(bundles.naver.error)
	}
	const quoteTimes = indices.flatMap((i) => (i.quoteTime ? [i.quoteTime] : []))
	const quoteTime = quoteTimes.length ? Math.max(...quoteTimes) : null
	const delayed = indices.filter((i) => i.delayMinutes > 0)
	return {
		market,
		label: MARKET_LABELS[market],
		session: getSessionInfo(market, now, quoteTime),
		indices,
		quoteTime,
		delayNote: delayed.length
			? `${delayed.map((i) => i.name).join('、')} 延迟 ${Math.max(...delayed.map((i) => i.delayMinutes))} 分钟`
			: '',
		sources: [...sources],
		fetchedAt: fetchedAt || now,
		stale: stale || indices.length === 0,
		...(errors.size ? { error: [...errors].join('; ').slice(0, 300) } : {}),
	}
}

export async function getOverview(): Promise<MarketOverviewResponse> {
	const bundles = await getIndexBundles()
	const now = Date.now()
	return { markets: MARKET_IDS.map((m) => buildOverviewItem(m, bundles, now)) }
}

export async function getMarketOverview(market: MarketId): Promise<MarketOverviewItem> {
	return buildOverviewItem(market, await getIndexBundles(), Date.now())
}

// ───────────────────────── 板块 ─────────────────────────

interface SectorPayload {
	items: SectorItem[]
	source: string
	delayMinutes: number
	/** 板块自带的行情时间（ETF/指数代理才有），没有就用大盘指数时间 */
	quoteTime: number | null
}

interface MarketSectorConfig {
	kinds: SectorKindOption[]
	currency: string
	listMode: Partial<Record<SectorKind, SectorListMode>>
	proxyNote: Partial<Record<SectorKind, string>>
}

export const SECTOR_CONFIG: Record<MarketId, MarketSectorConfig> = {
	cn: {
		kinds: [
			{
				kind: 'industry',
				label: '行业',
				levels: [
					{ value: '1', label: '一级行业' },
					{ value: '2', label: '二级行业' },
				],
			},
			{ kind: 'concept', label: '概念' },
		],
		currency: 'CNY',
		listMode: { industry: 'dynamic', concept: 'dynamic' },
		proxyNote: {},
	},
	hk: {
		kinds: [{ kind: 'industry', label: '行业' }],
		currency: 'HKD',
		listMode: { industry: 'fixed-proxy' },
		proxyNote: { industry: '以恒生综合行业指数代理（12 个行业）' },
	},
	us: {
		kinds: [
			{ kind: 'industry', label: '行业' },
			{ kind: 'concept', label: '细分/主题' },
		],
		currency: 'USD',
		listMode: { industry: 'fixed-proxy', concept: 'fixed-proxy' },
		proxyNote: {
			industry: '以 SPDR 行业 ETF 代理（11 个 GICS 一级行业）',
			concept: '以细分行业 / 主题 ETF 代理',
		},
	},
	jp: {
		kinds: [{ kind: 'industry', label: '行业' }],
		currency: 'JPY',
		listMode: { industry: 'fixed-proxy' },
		proxyNote: { industry: '以 TOPIX-17 行业 ETF 代理（NEXT FUNDS 1617–1633）' },
	},
	kr: {
		kinds: [
			{ kind: 'industry', label: '业种' },
			{ kind: 'concept', label: '主题' },
		],
		currency: '',
		listMode: { industry: 'dynamic', concept: 'dynamic' },
		proxyNote: {},
	},
}

const maxQuoteTime = (rows: QuoteRow[]) => {
	const ts = rows.flatMap((r) => (r.quoteTime ? [r.quoteTime] : []))
	return ts.length ? Math.max(...ts) : null
}

/** 固定代理列表 → 板块条目（按配置顺序对齐，名称用简称，原名放 rawName） */
function proxyItems(defs: ProxyDef[], rowFor: (d: ProxyDef) => QuoteRow | undefined): SectorItem[] {
	return defs.flatMap((d) => {
		const row = rowFor(d)
		if (!row) return []
		return [
			{
				code: d.code,
				name: d.name,
				rawName: row.name,
				price: row.price,
				changePct: row.changePct,
				amount: row.amount,
				netInflow: null,
				turnoverRate: null,
				upCount: null,
				downCount: null,
				total: null,
				leader: null,
			},
		]
	})
}

async function loadCnSectors(kind: SectorKind, level: string): Promise<SectorPayload> {
	try {
		const items = await fetchTencentBoards(kind === 'concept' ? 'gn' : level === '2' ? 'hy2' : 'hy')
		return {
			// 腾讯概念里混有「昨日连板/昨日涨停」这类统计口径的伪板块，不算题材，滤掉
			items: kind === 'concept' ? items.filter((i) => !i.name.startsWith('昨日')) : items,
			source: '腾讯自选股 板块排行（申万行业 / 概念）',
			delayMinutes: 0,
			quoteTime: null,
		}
	} catch (err) {
		console.warn('[markets] 腾讯板块失败，改用东财:', errorMessage(err))
		const items = await fetchEastmoneyBoards(
			kind === 'concept' ? 3 : 2,
			kind === 'industry' ? level : undefined,
		)
		return {
			items,
			source: '东方财富 push2 板块（东财行业 / 概念）',
			delayMinutes: 0,
			quoteTime: null,
		}
	}
}

async function loadHkSectors(): Promise<SectorPayload> {
	const rows = await fetchEastmoneyUlist(HK_INDUSTRY_INDICES.map((d) => `124.${d.code}`))
	const byCode = Object.fromEntries(rows.map((r) => [r.code, r]))
	return {
		items: proxyItems(HK_INDUSTRY_INDICES, (d) => byCode[d.code]),
		source: '东方财富 ulist（恒生综合行业指数）',
		delayMinutes: 0,
		quoteTime: maxQuoteTime(rows),
	}
}

async function loadUsSectors(kind: SectorKind): Promise<SectorPayload> {
	const defs = kind === 'concept' ? US_THEME_ETFS : US_SECTOR_ETFS
	let rows: QuoteRow[]
	let source = '腾讯行情 qt（美股 ETF）'
	// 腾讯美股 ETF 是延迟报价（分时接口 qt[0] 明确标 delay，指数才是 real），按 15 分钟计
	let delayMinutes = 15
	try {
		rows = await fetchTencentQt(defs.map((d) => `us${d.code}`))
	} catch (err) {
		console.warn('[markets] 腾讯美股失败，改用东财:', errorMessage(err))
		// 东财美股 secid 要带交易所（105 纳斯达克 / 106 纽交所 / 107 美交所/Arca），三个都问，取命中的
		rows = await fetchEastmoneyUlist(
			defs.flatMap((d) => ['105', '106', '107'].map((m) => `${m}.${d.code}`)),
		)
		source = '东方财富 ulist（美股 ETF）'
		delayMinutes = 0
	}
	const byCode = Object.fromEntries(rows.map((r) => [r.code.toUpperCase(), r]))
	return {
		items: proxyItems(defs, (d) => byCode[d.code]),
		source,
		delayMinutes,
		quoteTime: maxQuoteTime(rows),
	}
}

async function loadJpSectors(): Promise<SectorPayload> {
	const rows = await fetchNaverPolling(
		'worldstock/stock',
		JP_TOPIX17_ETFS.map((d) => `${d.code}.T`),
	)
	const byCode = Object.fromEntries(rows.map((r) => [r.code, r]))
	return {
		items: proxyItems(JP_TOPIX17_ETFS, (d) => byCode[`${d.code}.T`]),
		source: 'Naver 证券（东证 ETF）',
		delayMinutes: Math.max(0, ...rows.map((r) => r.delayMinutes)),
		quoteTime: maxQuoteTime(rows),
	}
}

async function loadKrSectors(kind: SectorKind): Promise<SectorPayload> {
	const items =
		kind === 'concept'
			? await fetchNaverGroups('theme')
			: await fetchNaverGroups('industry', KR_INDUSTRY_ZH)
	return {
		items,
		source: kind === 'concept' ? 'Naver 证券 主题（테마）' : 'Naver 证券 业种（업종）',
		delayMinutes: 0,
		quoteTime: null,
	}
}

function loadSectors(market: MarketId, kind: SectorKind, level: string): Promise<SectorPayload> {
	switch (market) {
		case 'cn':
			return loadCnSectors(kind, level)
		case 'hk':
			return loadHkSectors()
		case 'us':
			return loadUsSectors(kind)
		case 'jp':
			return loadJpSectors()
		case 'kr':
			return loadKrSectors(kind)
	}
}

const SORT_KEYS: SectorSortKey[] = ['changePct', 'amount', 'netInflow', 'turnoverRate']

export async function getSectors(
	market: MarketId,
	kind: SectorKind,
	levelInput?: string,
): Promise<MarketSectorsResponse> {
	const config = SECTOR_CONFIG[market]
	const kindOption = config.kinds.find((k) => k.kind === kind)
	if (!kindOption) throw new MarketInputError('该市场暂不支持此板块类别')
	const level = kindOption.levels
		? (kindOption.levels.find((l) => l.value === levelInput)?.value ?? kindOption.levels[0].value)
		: ''

	const overview = await getMarketOverview(market)
	const clockSession = getSessionInfo(market, Date.now(), overview.quoteTime)
	const result = await cachedLoad(
		`sectors:${market}:${kind}:${level}`,
		CACHE_TTL_MS[clockSession.status],
		() => loadSectors(market, kind, level),
	)
	const payload = result.value
	const quoteTime = payload.quoteTime ?? overview.quoteTime
	const items = [...payload.items].sort(
		(a, b) => (b.changePct ?? Number.NEGATIVE_INFINITY) - (a.changePct ?? Number.NEGATIVE_INFINITY),
	)
	return {
		market,
		kind,
		...(level ? { level } : {}),
		kinds: config.kinds,
		items,
		sortKeys: SORT_KEYS.filter((key) => items.some((item) => item[key] != null)),
		listMode: config.listMode[kind] ?? 'dynamic',
		...(config.proxyNote[kind] ? { proxyNote: config.proxyNote[kind] } : {}),
		source: payload.source,
		realtime: payload.delayMinutes === 0,
		delayMinutes: payload.delayMinutes,
		amountCurrency: config.currency,
		session: getSessionInfo(market, Date.now(), quoteTime),
		quoteTime,
		fetchedAt: result.fetchedAt,
		stale: result.stale,
		...(result.error ? { error: result.error.slice(0, 300) } : {}),
	}
}
