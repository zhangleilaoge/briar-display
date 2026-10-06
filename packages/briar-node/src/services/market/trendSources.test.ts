import { beforeEach, describe, expect, test } from 'bun:test'
import { zonedTimeToTs } from './session'
import { getChart, sessionRanges, toMinuteDay, toSeries } from './trendService'
import {
	__resetEastmoneyTrendSlots,
	chainPrevClose,
	cumulativeToDelta,
	groupByDay,
	normalizeCandles,
	normalizePoints,
	parseEastmoneyKline,
	parseEastmoneyMultiDay,
	parseEastmoneyTrends,
	parseLocalStamp,
	parseNaverCandles,
	parseNaverDomesticMinute,
	parseNaverPricesByPeriod,
	parseTencentFiveDay,
	parseTencentKline,
	parseTencentMinute,
	parseTencentUsKlineCode,
	takeEastmoneyTrendSlot,
} from './trendSources'

const sh = (h: number, mi: number, d = 30, mo = 9) =>
	zonedTimeToTs('Asia/Shanghai', 2026, mo, d, h, mi)

describe('分时数据源解析', () => {
	test('时间串：紧凑 / 带分隔符 / 带秒，按指定时区换算', () => {
		expect(parseLocalStamp('202609300930', 'Asia/Shanghai')).toBe(sh(9, 30))
		expect(parseLocalStamp('2026-09-30 13:01', 'Asia/Shanghai')).toBe(sh(13, 1))
		expect(parseLocalStamp('20261006090000', 'Asia/Tokyo')).toBe(
			zonedTimeToTs('Asia/Tokyo', 2026, 10, 6, 9, 0),
		)
		expect(parseLocalStamp('bad', 'Asia/Shanghai')).toBeNull()
	})

	test('normalizePoints 排序、去重、丢弃非法价格', () => {
		expect(
			normalizePoints([
				[2, 10, 1],
				[1, 9, null],
				[2, 11, 2],
				[3, 0, 1],
				[4, Number.NaN, 1],
			]),
		).toEqual([
			[1, 9, null],
			[2, 11, 2],
		])
	})

	test('累计量转每分钟量，源回退时截成 0', () => {
		expect(
			cumulativeToDelta([
				[1, 10, 100],
				[2, 10, 250],
				[3, 10, 240],
				[4, 10, 300],
				[5, 10, null],
			]),
		).toEqual([
			[1, 10, 100],
			[2, 10, 150],
			[3, 10, 0],
			[4, 10, 50],
			[5, 10, null],
		])
	})

	test('腾讯分时：A股板块 pt 代码，qt[4] 为昨收，量转每分钟', () => {
		const json = {
			code: 0,
			data: {
				pt01801780: {
					data: { date: '20260930', data: ['0930 4150.25 685432.0', '1500 4203.77 33681100.0'] },
					qt: { pt01801780: ['2', '银行', '01801780', '4203.77', '4142.94'] },
				},
			},
		}
		const t = parseTencentMinute(json, 'pt01801780', 'Asia/Shanghai')
		expect(t.name).toBe('银行')
		expect(t.prevClose).toBe(4142.94)
		expect(t.points).toEqual([
			[sh(9, 30), 4150.25, 685432],
			[sh(15, 0), 4203.77, 33681100 - 685432],
		])
		expect(t.delayMinutes).toBe(0)
	})

	test('腾讯美股分时：美东时间，ETF 标 delay → 15 分钟；无数据（港股行业指数）为空', () => {
		const json = {
			data: {
				usXLK: {
					data: { date: '20261005', data: ['0930 200.02 31963', '1600 200.93 6595257'] },
					qt: { usXLK: ['delay', '科技行业精选ETF-SPDR', 'XLK.AM', '200.93', '199.81'] },
				},
				hkHSCIIT: { data: { date: '', data: ['  0'] }, qt: { hkHSCIIT: [] } },
			},
		}
		const t = parseTencentMinute(json, 'usXLK', 'America/New_York')
		expect(t.delayMinutes).toBe(15)
		expect(t.points[0][0]).toBe(zonedTimeToTs('America/New_York', 2026, 10, 5, 9, 30))
		expect(parseTencentMinute(json, 'hkHSCIIT', 'Asia/Hong_Kong').points).toEqual([])
	})

	test('腾讯五日：按日期升序，每天带 prec 昨收', () => {
		const json = {
			data: {
				sh000001: {
					data: [
						{ date: '20260930', prec: '3830.45', data: ['0930 3839.25 100', '1500 3842.19 300'] },
						{ date: '20260929', prec: '3823.62', data: ['0930 3825.00 50'] },
						{ date: '20260928', prec: '1', data: [] },
					],
					qt: { sh000001: ['1', '上证指数'] },
				},
			},
		}
		const r = parseTencentFiveDay(json, 'sh000001', 'Asia/Shanghai')
		expect(r.name).toBe('上证指数')
		expect(r.days.map((d) => [d.date, d.prevClose, d.points.length])).toEqual([
			['2026-09-29', 3823.62, 1],
			['2026-09-30', 3830.45, 2],
		])
		expect(r.days[1].points[1]).toEqual([sh(15, 0), 3842.19, 200])
	})

	test('腾讯 K 线：开收高低 → 开高低收，兼容 qfqday / day 键', () => {
		const rows = [
			['2026-09-29', '13459.01', '13349.74', '13459.01', '13278.97', '929084448', {}],
			['2026-09-30', '13323.04', '13315.04', '13356.19', '13180.90', '839001344.00'],
			['bad', '1', '1', '1', '1', '1'],
		]
		const r = parseTencentKline({ data: { hkHSI: { day: rows } } }, 'hkHSI', 'day')
		expect(r.candles).toEqual([
			['2026-09-29', 13459.01, 13459.01, 13278.97, 13349.74, 929084448],
			['2026-09-30', 13323.04, 13356.19, 13180.9, 13315.04, 839001344],
		])
		const q = parseTencentKline({ data: { sh000001: { qfqweek: rows } } }, 'sh000001', 'week')
		expect(q.candles.length).toBe(2)
		expect(parseTencentKline({ data: {} }, 'x', 'month').candles).toEqual([])
	})

	test('腾讯美股 K 线代码：qt 第 3 段带交易所后缀', () => {
		expect(parseTencentUsKlineCode('v_usXLK="200~科技ETF~XLK.AM~200.93";', 'usXLK')).toBe(
			'usXLK.AM',
		)
		expect(parseTencentUsKlineCode('v_usINX="200~标普500~.INX~7773.95";', 'usINX')).toBe('us.INX')
		expect(parseTencentUsKlineCode('v_pv_none_match="1";', 'usFOO')).toBeNull()
	})

	test('Naver pricesByPeriod：用 priceInfos + lastClosePrice，累计量转每分钟', () => {
		const t = parseNaverPricesByPeriod(
			{
				isSuccess: true,
				result: {
					lastClosePrice: 4145.22,
					priceInfos: [
						{
							localDateTime: '20261006090000',
							currentPrice: 4160.07,
							accumulatedTradingVolume: 10,
						},
						{ localDateTime: '20261006090100', currentPrice: 4161, accumulatedTradingVolume: 25 },
					],
				},
			},
			'Asia/Tokyo',
			15,
		)
		expect(t.prevClose).toBe(4145.22)
		expect(t.points).toEqual([
			[zonedTimeToTs('Asia/Tokyo', 2026, 10, 6, 9, 0), 4160.07, 10],
			[zonedTimeToTs('Asia/Tokyo', 2026, 10, 6, 9, 1), 4161, 15],
		])
		expect(t.delayMinutes).toBe(15)
		const pre = parseNaverPricesByPeriod(
			{ isSuccess: true, result: { lastClosePrice: 1 } },
			'Asia/Tokyo',
			15,
		)
		expect(pre.points).toEqual([])
	})

	test('Naver 韩国指数分时（首尔时间，无昨收，量已是每分钟）', () => {
		const t = parseNaverDomesticMinute([
			{ localDateTime: '20261006090000', currentPrice: 7041.46, accumulatedTradingVolume: 7818 },
		])
		expect(t.points[0]).toEqual([zonedTimeToTs('Asia/Seoul', 2026, 10, 6, 9, 0), 7041.46, 7818])
		expect(t.prevClose).toBeNull()
	})

	test('Naver K 线', () => {
		expect(
			parseNaverCandles([
				{
					localDate: '20261006',
					openPrice: 7044.67,
					highPrice: 7044.67,
					lowPrice: 6897.38,
					closePrice: 6941.39,
					accumulatedTradingVolume: 257269,
				},
				{ localDate: '20261005', closePrice: 1 },
			]),
		).toEqual([['2026-10-06', 7044.67, 7044.67, 6897.38, 6941.39, 257269]])
	})

	test('东财 trends2：北京时间，取第 3 列（现价）和第 6 列（量）', () => {
		const t = parseEastmoneyTrends({
			data: {
				name: '恒生资讯科技业指数',
				preClose: 13124.89,
				trends: ['2026-10-06 09:30,13214.11,13214.11,13214.11,13214.11,4520132,0.00,0.000'],
			},
		})
		expect(t.points).toEqual([[sh(9, 30, 6, 10), 13214.11, 4520132]])
		expect(t.prevClose).toBe(13124.89)
		expect(parseEastmoneyTrends({ data: null }).points).toEqual([])
	})

	test('东财五日：按当地日期分组，次日昨收用前一天最后一笔', () => {
		const r = parseEastmoneyMultiDay(
			{
				data: {
					prePrice: 100,
					trends: [
						'2026-10-05 09:30,1,101,1,1,10',
						'2026-10-05 16:00,1,102,1,1,10',
						'2026-10-06 09:30,1,103,1,1,10',
					],
				},
			},
			'Asia/Hong_Kong',
			5,
		)
		expect(r.days.map((d) => [d.date, d.prevClose])).toEqual([
			['2026-10-05', 100],
			['2026-10-06', 102],
		])
	})

	test('东财 K 线', () => {
		const r = parseEastmoneyKline({
			data: {
				name: '恒生资讯科技业指数',
				klines: ['2026-10-06,13214.11,13232.82,13288.33,13162.86,311404256,14383141888.00'],
			},
		})
		expect(r.candles).toEqual([['2026-10-06', 13214.11, 13288.33, 13162.86, 13232.82, 311404256]])
	})

	test('多日分组 + 昨收补齐 + 只留最近 n 天', () => {
		const days = groupByDay(
			[
				[sh(9, 30, 28), 1, 1],
				[sh(15, 0, 28), 2, 1],
				[sh(9, 30, 29), 3, 1],
				[sh(9, 30, 30), 4, 1],
			],
			'Asia/Shanghai',
		)
		expect(days.map((d) => d.date)).toEqual(['2026-09-28', '2026-09-29', '2026-09-30'])
		const last2 = chainPrevClose(days, 2)
		expect(last2.map((d) => [d.date, d.prevClose])).toEqual([
			['2026-09-29', 2],
			['2026-09-30', 3],
		])
	})

	test('K 线清洗：去重、升序、丢非法', () => {
		expect(
			normalizeCandles([
				['2026-10-02', 1, 2, 1, 2, null],
				['2026-10-01', 1, 2, 1, 2, 5],
				['2026-10-02', 2, 3, 2, 3, 1],
				['2026-10-03', 0, 1, 1, 1, 1],
			]),
		).toEqual([
			['2026-10-01', 1, 2, 1, 2, 5],
			['2026-10-02', 2, 3, 2, 3, 1],
		])
	})
})

describe('东财限流', () => {
	beforeEach(() => __resetEastmoneyTrendSlots())

	test('每分钟最多 6 次，窗口滑过后恢复', () => {
		const t0 = 1_000_000
		for (let i = 0; i < 6; i++) expect(takeEastmoneyTrendSlot(t0 + i)).toBe(true)
		expect(takeEastmoneyTrendSlot(t0 + 10)).toBe(false)
		expect(takeEastmoneyTrendSlot(t0 + 60_000)).toBe(true)
	})
})

describe('分时横轴时段', () => {
	test('按当地交易日生成连续竞价区间（含午休断开，美股按美东）', () => {
		expect(sessionRanges('cn', '2026-09-30')).toEqual([
			[sh(9, 30), sh(11, 30)],
			[sh(13, 0), sh(15, 0)],
		])
		const [[open, close]] = sessionRanges('us', '2026-10-05')
		expect(open).toBe(zonedTimeToTs('America/New_York', 2026, 10, 5, 9, 30))
		expect(close - open).toBe(390 * 60_000)
	})

	test('toSeries：交易日取最后一个点的当地日期，小图只保留价格', () => {
		const raw = {
			name: null,
			prevClose: 3830.45,
			points: [[sh(15, 0), 3842.19, 100] as [number, number, number]],
			delayMinutes: 0,
			source: '腾讯分时',
		}
		const s = toSeries('cn', 'sh000001', '上证指数', raw)
		expect(s.tradeDate).toBe('2026-09-30')
		expect(s.sessions[0][0]).toBe(sh(9, 30))
		expect(s.points).toEqual([[sh(15, 0), 3842.19]])
		const day = toMinuteDay('cn', raw)
		expect(day.date).toBe('2026-09-30')
		expect(day.points[0][2]).toBe(100)
	})
})

describe('走势面板周期支持', () => {
	test('韩国板块全部周期置灰并给原因；日本五日置灰；未知代码 400', async () => {
		const kr = await getChart('kr', 'sector', '261', 'day')
		expect(kr.available).toBe(false)
		expect(kr.periods.every((p) => !p.available && p.reason)).toBe(true)
		const jp = await getChart('jp', 'sector', '1617', '5day')
		expect(jp.available).toBe(false)
		expect(jp.periods.find((p) => p.period === 'day')?.available).toBe(true)
		await expect(getChart('hk', 'sector', 'NOPE', 'day')).rejects.toThrow('未知的板块代码')
		await expect(getChart('us', 'index', 'NOPE', 'day')).rejects.toThrow('未知的指数代码')
	})
})
