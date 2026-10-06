import type { ConstituentItem, SectorItem, StockQuote } from '@briar/shared'
import { cachedLoad } from './cache'
import { CONCEPT_SECTORS, type CuratedMember, type CuratedSectorDef } from './catalog'
import { CACHE_TTL_MS, getSessionStatus } from './session'
import { type RawConstituents, fetchTencentStockQuotes } from './stockSources'

/**
 * 人工维护题材板块（港股 / 美股概念 tab）的行情聚合：
 * 名单在 catalog.ts，行情全部来自腾讯 qt 批量报价（港股 / 美股均延迟 15 分钟）。
 * 板块涨跌幅 = 有报价成分股的等权平均；成交额 = 求和；涨跌家数 / 领涨股直接统计。
 * 全部成员一次请求拿全（单市场一个缓存条目，各板块共享，避免重叠成员重复请求）。
 */

export type CuratedMarket = keyof typeof CONCEPT_SECTORS

const memberId = (m: CuratedMember) => `${m.market}:${m.code}`

/** 聚合口径说明（接口 reason / 文档共用） */
export const CURATED_NO_TREND = '概念板块为人工维护的成分股组合，没有对应指数走势'

/** 题材板块清单 → 板块条目（纯函数，便于单测） */
export function buildCuratedSectorItems(
	defs: CuratedSectorDef[],
	quotes: Map<string, StockQuote>,
): SectorItem[] {
	return defs.map((def) => {
		const rows = def.members.flatMap((m) => {
			const q = quotes.get(memberId(m))
			return q ? [q] : []
		})
		const changes = rows.flatMap((r) => (r.changePct != null ? [r.changePct] : []))
		const amount = rows.reduce((sum, r) => sum + (r.amount ?? 0), 0)
		const leader = rows.reduce<StockQuote | null>(
			(best, r) =>
				r.changePct != null && (best?.changePct ?? Number.NEGATIVE_INFINITY) < r.changePct
					? r
					: best,
			null,
		)
		return {
			code: def.code,
			name: def.name,
			price: null,
			changePct:
				changes.length > 0
					? Number((changes.reduce((a, b) => a + b, 0) / changes.length).toFixed(2))
					: null,
			amount: amount > 0 ? amount : null,
			netInflow: null,
			turnoverRate: null,
			upCount: rows.filter((r) => (r.changePct ?? 0) > 0).length,
			downCount: rows.filter((r) => (r.changePct ?? 0) < 0).length,
			total: def.members.length,
			leader: leader ? { name: leader.name, code: leader.code, changePct: leader.changePct } : null,
		}
	})
}

/** 题材板块 → 成分股条目（纯函数，便于单测） */
export function buildCuratedConstituents(
	def: CuratedSectorDef,
	quotes: Map<string, StockQuote>,
): ConstituentItem[] {
	return def.members.map((m) => {
		const q = quotes.get(memberId(m))
		return {
			code: m.code,
			name: q?.name || m.code,
			price: q?.price ?? null,
			changePct: q?.changePct ?? null,
			amount: q?.amount ?? null,
			turnoverRate: q?.turnoverRate ?? null,
			netInflow: null,
			marketCap: q?.marketCap ?? null,
			pe: q?.pe ?? null,
		}
	})
}

/** 单个市场全部题材成员的去重列表 */
export function curatedMembers(market: CuratedMarket): { market: CuratedMarket; code: string }[] {
	const seen = new Set<string>()
	const out: { market: CuratedMarket; code: string }[] = []
	for (const def of CONCEPT_SECTORS[market]) {
		for (const m of def.members) {
			if (seen.has(memberId(m))) continue
			seen.add(memberId(m))
			out.push({ market, code: m.code })
		}
	}
	return out
}

/** 全市场成员报价（一个缓存条目，成员重叠的板块共用；部分批次失败不致命） */
async function loadCuratedQuotes(market: CuratedMarket): Promise<Map<string, StockQuote>> {
	const members = curatedMembers(market)
	const ttl = CACHE_TTL_MS[getSessionStatus(market, Date.now())]
	const result = await cachedLoad(`curated:quotes:${market}`, ttl, async () => {
		const quotes = new Map<string, StockQuote>()
		for (let i = 0; i < members.length; i += 100) {
			try {
				for (const q of await fetchTencentStockQuotes(members.slice(i, i + 100))) {
					quotes.set(`${q.market}:${q.code}`, q)
				}
			} catch (err) {
				console.warn(`[markets] 题材成分股报价（${market}）批次失败:`, err)
			}
		}
		if (quotes.size === 0) throw new Error(`curated quotes ${market}: empty`)
		return quotes
	})
	return result.value
}

/** 概念 tab 板块列表 payload（marketService 包装 source / 延迟） */
export async function loadCuratedSectors(market: CuratedMarket): Promise<{
	items: SectorItem[]
	quoteTime: number | null
}> {
	const quotes = await loadCuratedQuotes(market)
	const quoteTime = Math.max(
		0,
		...[...quotes.values()].flatMap((q) => (q.quoteTime ? [q.quoteTime] : [])),
	)
	return {
		items: buildCuratedSectorItems(CONCEPT_SECTORS[market], quotes),
		quoteTime: quoteTime || null,
	}
}

/** 概念板块成分股（名单即成分股，报价缺失时字段留空） */
export async function loadCuratedConstituents(
	market: CuratedMarket,
	code: string,
): Promise<RawConstituents> {
	const def = CONCEPT_SECTORS[market].find((d) => d.code === code)
	if (!def) throw new Error(`未知概念板块 ${code}`)
	const quotes = await loadCuratedQuotes(market)
	return { items: buildCuratedConstituents(def, quotes), total: def.members.length }
}
