import { describe, expect, test } from 'bun:test'
import {
	assertCompletedMonth,
	buildScaleData,
	createSnapshot,
	latestCompletedMonth,
	mergeSnapshots,
	monthBounds,
	shanghaiDate,
	wanSharesToShares,
	yiYuanToYuan,
} from './csi300EtfScale'
import {
	parseNavTrend,
	parseSseEtfShares,
	parseSseIndexMonth,
	parseSzseSharePage,
} from './csi300EtfSources'

const NOW = Date.UTC(2026, 9, 27, 4)

function snapshot(date: string, indexClose = 4357.62) {
	return createSnapshot(
		{ date, indexClose, floatMarketCap: 50_000_000_000_000 },
		Object.fromEntries(
			['510300', '510330', '159919', '510310'].map((code) => [code, 1_000_000_000]),
		),
		{
			'510300': { date, unitNav: 4, cumulativeNav: 2 },
			'510330': { date, unitNav: 3, cumulativeNav: 1.5 },
			'159919': { date, unitNav: 2, cumulativeNav: 1 },
			'510310': { date, unitNav: 1, cumulativeNav: 0.5 },
		},
	)
}

describe('头部沪深300ETF占比：单位与日期', () => {
	test('万份和亿元统一换算成原始单位', () => {
		expect(wanSharesToShares('3524268.77')).toBe(35_242_687_700)
		expect(yiYuanToYuan('504119.48')).toBe(50_411_948_000_000)
		expect(() => wanSharesToShares('')).toThrow()
		expect(() => yiYuanToYuan(-1)).toThrow()
	})

	test('净值时间戳按上海时区取日期，不依赖进程时区', () => {
		expect(shanghaiDate(Date.UTC(2026, 8, 30))).toBe('2026-09-30')
		expect(shanghaiDate(Date.UTC(2026, 8, 29, 16))).toBe('2026-09-30')
	})

	test('只允许已结束月份，月末边界正确', () => {
		expect(latestCompletedMonth(NOW)).toBe('202609')
		expect(latestCompletedMonth(Date.UTC(2026, 10, 1))).toBe('202610')
		expect(monthBounds('202609')).toEqual({ start: '2026-09-01', end: '2026-09-30' })
		expect(monthBounds('202602')).toEqual({ start: '2026-02-01', end: '2026-02-28' })
		expect(() => assertCompletedMonth('202610', NOW)).toThrow('尚未结束')
		expect(() => monthBounds('202613')).toThrow('无效月份')
	})
})

describe('头部沪深300ETF占比：上游解析', () => {
	test('上交所按代码取当日份额，拒绝用其他交易日代替', () => {
		const result = ['510300', '510330', '510310'].map((code, i) => ({
			STAT_DATE: '2026-09-30',
			SEC_CODE: code,
			TOT_VOL: String(100 + i),
		}))
		expect(parseSseEtfShares({ result }, '2026-09-30')).toEqual({
			'510300': 1_000_000,
			'510330': 1_010_000,
			'510310': 1_020_000,
		})
		expect(() => parseSseEtfShares({ result }, '2026-09-29')).toThrow('缺少')
	})

	test('深交所去除千分位，保留真实分页数', () => {
		expect(
			parseSzseSharePage([
				{
					metadata: { pagecount: 2 },
					data: [
						{
							size_date: '2026-09-30',
							fund_code: '159919',
							current_size: '686,631.66',
						},
					],
				},
			]),
		).toEqual({ shares: { '2026-09-30': 6_866_316_600 }, pageCount: 2 })
	})

	test('同时解析单位净值和累计净值，缺失时明确报错', () => {
		const timestamp = Date.UTC(2026, 8, 30)
		const navTrend = JSON.stringify([{ x: timestamp, y: 4.1797 }])
		const parsed = parseNavTrend(
			`var Data_ACWorthTrend = [[${timestamp},1.8769]];\nvar Data_netWorthTrend = ${navTrend};`,
		)
		expect(parsed['2026-09-30']).toEqual({
			date: '2026-09-30',
			unitNav: 4.1797,
			cumulativeNav: 1.8769,
		})
		expect(() => parseNavTrend('var Data_ACWorthTrend = [];')).toThrow('Data_netWorthTrend')
		expect(() =>
			parseNavTrend(`var Data_ACWorthTrend = [];\nvar Data_netWorthTrend = ${navTrend};`),
		).toThrow('缺少当日累计净值')
	})

	test('上交所月报解析收盘和流通市值并排序，空结果保留为空', () => {
		expect(
			parseSseIndexMonth(
				{
					result: [
						{ MDATE: '20260930', CLS: '4357.62', CPT_NGT: '504119.48' },
						{ MDATE: '20260901', CLS: '4611.44', CPT_NGT: '527896.32' },
					],
				},
				'202609',
			),
		).toEqual([
			{ date: '2026-09-01', indexClose: 4611.44, floatMarketCap: 52_789_632_000_000 },
			{ date: '2026-09-30', indexClose: 4357.62, floatMarketCap: 50_411_948_000_000 },
		])
		expect(parseSseIndexMonth({ result: [] }, '202610')).toEqual([])
	})
})

describe('头部沪深300ETF占比：快照与曲线', () => {
	test('实际规模和视频口径分别求和后除以流通市值', () => {
		const data = buildScaleData([snapshot('2026-09-30')])
		expect(data.asOf).toBe('2026-09-30')
		expect(data.points[0].totalAssets).toBe(10_000_000_000)
		expect(data.points[0].ratioPct).toBe(0.02)
		expect(data.points[0].videoValue).toBe(5_000_000_000)
		expect(data.points[0].videoRatioPct).toBe(0.01)
		expect(data.funds.map((fund) => fund.assets)).toEqual([
			4_000_000_000, 3_000_000_000, 2_000_000_000, 1_000_000_000,
		])
		expect(data.funds.map((fund) => fund.cumulativeValue)).toEqual([
			2_000_000_000, 1_500_000_000, 1_000_000_000, 500_000_000,
		])
	})

	test('净值日期错位或基金份额缺失时不补零', () => {
		expect(() =>
			createSnapshot(
				{ date: '2026-09-30', indexClose: 4357.62, floatMarketCap: 50_000_000_000_000 },
				{ '510300': 1_000_000 },
				{ '510300': { date: '2026-09-29', unitNav: 4 } },
			),
		).toThrow('缺少当日单位净值')
		expect(() =>
			createSnapshot(
				{ date: '2026-09-30', indexClose: 4357.62, floatMarketCap: 50_000_000_000_000 },
				{ '510300': 1_000_000 },
				{
					'510300': { date: '2026-09-30', unitNav: 4 },
					'510330': { date: '2026-09-30', unitNav: 3 },
					'159919': { date: '2026-09-30', unitNav: 2 },
					'510310': { date: '2026-09-30', unitNav: 1 },
				},
			),
		).toThrow('无效数值')
	})

	test('数据库覆盖同日种子，保留2022年10月10日以来数据并排序', () => {
		const merged = mergeSnapshots(
			[snapshot('2022-10-09'), snapshot('2025-01-01'), snapshot('2026-09-30')],
			[snapshot('2026-09-30', 4400), snapshot('2026-09-29')],
			NOW,
		)
		expect(merged.map((item) => item.date)).toEqual(['2025-01-01', '2026-09-29', '2026-09-30'])
		expect(merged[2].indexClose).toBe(4400)
	})

	test('旧数据库快照从同日种子继承累计净值', () => {
		const legacy = snapshot('2026-09-30', 4400)
		for (const fund of legacy.funds) fund.cumulativeNav = undefined
		const merged = mergeSnapshots([snapshot('2026-09-30')], [legacy], NOW)
		expect(merged[0].indexClose).toBe(4400)
		expect(merged[0].funds.map((fund) => fund.cumulativeNav)).toEqual([2, 1.5, 1, 0.5])
		expect(() => buildScaleData([legacy])).toThrow('缺少当日累计净值')
	})

	test('最新基金明细与最后一个曲线点严格同日', () => {
		const data = buildScaleData([snapshot('2026-09-29'), snapshot('2026-09-30')])
		expect(data.points.at(-1)?.date).toBe(data.asOf)
		expect(data.funds[0].unitNav).toBe(4)
		expect(data.funds[0].cumulativeNav).toBe(2)
		expect(() => buildScaleData([])).toThrow('暂无')
	})

	test('2025-06-03视频采样点按累计净值口径可复算', () => {
		const date = '2025-06-03'
		const data = buildScaleData([
			createSnapshot(
				{ date, indexClose: 3852.01, floatMarketCap: 42_830_899_000_000 },
				{
					'510300': 95_611_087_700,
					'510330': 48_512_049_800,
					'159919': 41_988_816_600,
					'510310': 69_180_944_000,
				},
				{
					'510300': { date, unitNav: 3.9566, cumulativeNav: 1.7159 },
					'510330': { date, unitNav: 3.9821, cumulativeNav: 1.9494 },
					'159919': { date, unitNav: 3.9927, cumulativeNav: 1.8365 },
					'510310': { date, unitNav: 3.7819, cumulativeNav: 1.9398 },
				},
			),
		])
		const point = data.points[0]
		expect(point.indexClose).toBe(3852.01)
		expect(point.videoRatioPct).toBeCloseTo(1.0971941357608441, 10)
		expect(point.ratioPct).toBeCloseTo(2.3365347135366457, 10)
		expect(point.videoValue / 100_000_000).toBeCloseTo(4699.381121216499, 6)
	})
})
