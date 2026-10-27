import type { Csi300EtfScaleResponse } from '@briar/shared'
import { localParts } from './session'

export const CSI300_ETFS = [
	{ code: '510300', name: '华泰柏瑞沪深300ETF', exchange: 'sse' },
	{ code: '510330', name: '华夏沪深300ETF', exchange: 'sse' },
	{ code: '159919', name: '嘉实沪深300ETF', exchange: 'szse' },
	{ code: '510310', name: '易方达沪深300ETF', exchange: 'sse' },
] as const

export const CSI300_ETF_SOURCES = [
	'上海证券交易所：ETF 份额、沪深300收盘及流通市值',
	'深圳证券交易所：ETF 份额',
	'东方财富基金：单位净值、累计净值',
]

export const CSI300_HISTORY_START = '2022-10-10'

export interface Csi300EtfFundSnapshot {
	code: string
	shares: number
	unitNav: number
	cumulativeNav?: number
}

export interface Csi300EtfSnapshot {
	date: string
	indexClose: number
	floatMarketCap: number
	funds: Csi300EtfFundSnapshot[]
}

export interface Csi300EtfScaleSeed {
	generatedAt: number
	snapshots: Csi300EtfSnapshot[]
}

export interface Csi300IndexDay {
	date: string
	indexClose: number
	floatMarketCap: number
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function assertDate(value: string): string {
	const match = DATE_PATTERN.exec(value)
	if (!match) throw new Error(`无效日期: ${value}`)
	const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
	if (new Date(timestamp).toISOString().slice(0, 10) !== value) {
		throw new Error(`无效日期: ${value}`)
	}
	return value
}

export function shanghaiDate(timestamp: number): string {
	if (!Number.isFinite(timestamp)) throw new Error('无效时间戳')
	return localParts(timestamp, 'Asia/Shanghai').dateKey
}

export function positiveNumber(value: number | string, label: string): number {
	const parsed = Number(value)
	if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label}: 无效数值 ${value}`)
	return parsed
}

export const wanSharesToShares = (value: number | string) =>
	Math.round(positiveNumber(value, '基金份额（万份）') * 10_000)

export const yiYuanToYuan = (value: number | string) =>
	Math.round(positiveNumber(value, '流通市值（亿元）') * 100_000_000)

export function monthKey(date: string): string {
	return assertDate(date).slice(0, 7).replace('-', '')
}

export function latestCompletedMonth(now = Date.now()): string {
	const [year, month] = shanghaiDate(now).split('-').map(Number)
	return monthKey(new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 10))
}

export function monthBounds(month: string): { start: string; end: string } {
	const match = /^(\d{4})(\d{2})$/.exec(month)
	if (!match) throw new Error(`无效月份: ${month}`)
	const year = Number(match[1])
	const mo = Number(match[2])
	if (mo < 1 || mo > 12) throw new Error(`无效月份: ${month}`)
	return {
		start: `${match[1]}-${match[2]}-01`,
		end: new Date(Date.UTC(year, mo, 0)).toISOString().slice(0, 10),
	}
}

export function assertCompletedMonth(month: string, now = Date.now()): string {
	monthBounds(month)
	if (month > latestCompletedMonth(now)) throw new Error(`${month} 尚未结束，不能作为完整月份`)
	return month
}

export function createSnapshot(
	index: Csi300IndexDay,
	sharesByCode: Readonly<Record<string, number>>,
	navByCode: Readonly<Record<string, { date: string; unitNav: number; cumulativeNav?: number }>>,
): Csi300EtfSnapshot {
	assertDate(index.date)
	const funds = CSI300_ETFS.map((fund) => {
		const nav = navByCode[fund.code]
		if (nav?.date !== index.date) throw new Error(`${index.date} ${fund.code} 缺少当日单位净值`)
		return {
			code: fund.code,
			shares: positiveNumber(sharesByCode[fund.code], `${index.date} ${fund.code} 份额`),
			unitNav: positiveNumber(nav.unitNav, `${index.date} ${fund.code} 单位净值`),
			...(nav.cumulativeNav === undefined
				? {}
				: {
						cumulativeNav: positiveNumber(nav.cumulativeNav, `${index.date} ${fund.code} 累计净值`),
					}),
		}
	})
	return {
		date: index.date,
		indexClose: positiveNumber(index.indexClose, `${index.date} 沪深300收盘`),
		floatMarketCap: positiveNumber(index.floatMarketCap, `${index.date} 沪深300流通市值`),
		funds,
	}
}

function requireCumulativeNav(fund: Csi300EtfFundSnapshot, date: string) {
	if (fund.cumulativeNav === undefined) throw new Error(`${date} ${fund.code} 缺少当日累计净值`)
	return positiveNumber(fund.cumulativeNav, `${date} ${fund.code} 累计净值`)
}

export function mergeSnapshots(
	seed: readonly Csi300EtfSnapshot[],
	stored: readonly Csi300EtfSnapshot[],
	now = Date.now(),
): Csi300EtfSnapshot[] {
	const byDate = new Map(seed.map((snapshot) => [snapshot.date, snapshot]))
	for (const snapshot of stored) {
		const seededByCode = new Map(
			(byDate.get(snapshot.date)?.funds ?? []).map((fund) => [fund.code, fund]),
		)
		byDate.set(snapshot.date, {
			...snapshot,
			funds: snapshot.funds.map((fund) => {
				const cumulativeNav = fund.cumulativeNav ?? seededByCode.get(fund.code)?.cumulativeNav
				return { ...fund, ...(cumulativeNav === undefined ? {} : { cumulativeNav }) }
			}),
		})
	}
	const today = shanghaiDate(now)
	return [...byDate.values()]
		.filter((snapshot) => snapshot.date >= CSI300_HISTORY_START && snapshot.date <= today)
		.sort((a, b) => a.date.localeCompare(b.date))
}

export function buildScaleData(
	snapshots: readonly Csi300EtfSnapshot[],
): Omit<Csi300EtfScaleResponse, 'fetchedAt' | 'stale' | 'error'> {
	if (snapshots.length === 0) throw new Error('暂无头部沪深300ETF规模快照')
	const completeSnapshots = snapshots.map((snapshot) =>
		createSnapshot(
			snapshot,
			Object.fromEntries(snapshot.funds.map((fund) => [fund.code, fund.shares])),
			Object.fromEntries(
				snapshot.funds.map((fund) => [
					fund.code,
					{
						date: snapshot.date,
						unitNav: fund.unitNav,
						...(fund.cumulativeNav === undefined ? {} : { cumulativeNav: fund.cumulativeNav }),
					},
				]),
			),
		),
	)
	const points = completeSnapshots.map((snapshot) => {
		const totalAssets = snapshot.funds.reduce((sum, fund) => sum + fund.shares * fund.unitNav, 0)
		const videoValue = snapshot.funds.reduce(
			(sum, fund) => sum + fund.shares * requireCumulativeNav(fund, snapshot.date),
			0,
		)
		return {
			date: snapshot.date,
			ratioPct: (totalAssets / snapshot.floatMarketCap) * 100,
			videoRatioPct: (videoValue / snapshot.floatMarketCap) * 100,
			indexClose: snapshot.indexClose,
			totalAssets,
			videoValue,
			floatMarketCap: snapshot.floatMarketCap,
		}
	})
	const latest = completeSnapshots.at(-1) as Csi300EtfSnapshot
	return {
		asOf: latest.date,
		points,
		funds: latest.funds.map((fund) => ({
			...fund,
			cumulativeNav: requireCumulativeNav(fund, latest.date),
			name: CSI300_ETFS.find((item) => item.code === fund.code)?.name ?? fund.code,
			assets: fund.shares * fund.unitNav,
			cumulativeValue: fund.shares * requireCumulativeNav(fund, latest.date),
		})),
		sources: [...CSI300_ETF_SOURCES],
		pollMs: 60 * 60_000,
	}
}
