import { describe, expect, test } from 'bun:test'
import { parseJpxCandles, parseJpxIntraday } from './jpxTrendSources'
import { zonedTimeToTs } from './session'

const response = (entry: Record<string, unknown>, qcode = '151') => ({
	section1: { status: 0, data: { [qcode]: entry }, hitcount: 1, type: 'idx' },
	status: 0,
	ver: '1.0',
})

const minuteEntry = () => ({
	HISTMDATE1: '2026/10/23',
	HISTMIN1: [
		['09:00', '3985.70', '3977.16', '3985.98', '3976.48', '0', '0'],
		['09:01', '3977.16', '3980.25', '3981.00', '3977.00', '12', '0'],
	],
	PRP: '3960.50',
	NAME: 'TOPIX',
})

describe('JPX 官方指数分时', () => {
	test('按东京时间解析当天分钟，收在第 3 列，保留行量和前收', () => {
		const trend = parseJpxIntraday(response(minuteEntry()), '151')
		expect(trend).toEqual({
			name: 'TOPIX',
			prevClose: 3960.5,
			points: [
				[zonedTimeToTs('Asia/Tokyo', 2026, 10, 23, 9, 0), 3977.16, 0],
				[zonedTimeToTs('Asia/Tokyo', 2026, 10, 23, 9, 1), 3980.25, 12],
			],
			delayMinutes: 0,
			source: 'JPX 官方指数分时',
		})
	})

	test('状态、条目、所需数组或有效点缺失时抛错', () => {
		expect(() => parseJpxIntraday({ ...response(minuteEntry()), status: 1 }, '151')).toThrow(
			'bad status',
		)
		expect(() => parseJpxIntraday(response(minuteEntry()), '999')).toThrow('missing entry')
		expect(() => parseJpxIntraday(response({ ...minuteEntry(), HISTMIN1: [] }), '151')).toThrow(
			'empty HISTMIN1',
		)
		expect(() =>
			parseJpxIntraday(response({ ...minuteEntry(), HISTMIN1: [['bad', '1', '1']] }), '151'),
		).toThrow('no valid points')
	})

	test('跳过坏行，拒绝非法日期', () => {
		const entry: Record<string, unknown> = minuteEntry()
		entry.HISTMIN1 = [
			['09:00', '1', '3977.16', '1', '1', '0'],
			['25:00', '1', '3980', '1', '1', '1'],
			['09:02', '1', '-', '1', '1', '1'],
			'bad',
		]
		expect(parseJpxIntraday(response(entry), '151').points).toHaveLength(1)
		expect(() => parseJpxIntraday(response({ ...entry, HISTMDATE1: '2026/02/30' }), '151')).toThrow(
			'invalid HISTMDATE1',
		)
	})
})

describe('JPX 官方指数K线', () => {
	const rows = {
		A_HISTDAYL: [['2026/10/22', '10', '13', '9', '12', '100']],
		A_HISTWEEKL: [['2026/10/19', '20', '24', '19', '23', '200']],
		A_HISTMONTHL: [['2026/10/01', '30', '35', '29', '34', '300']],
	}

	test('日周月映射到各自数组，日期和 OHLCV 正确', () => {
		const json = response({ ...rows, NAME: 'TOPIX' })
		expect(parseJpxCandles(json, '151', 'day', '2026-10-23')).toEqual({
			name: 'TOPIX',
			candles: [['2026-10-22', 10, 13, 9, 12, 100]],
			source: 'JPX 官方指数K线',
		})
		expect(parseJpxCandles(json, '151', 'week', '2026-10-23').candles).toEqual([
			['2026-10-19', 20, 24, 19, 23, 200],
		])
		expect(parseJpxCandles(json, '151', 'month', '2026-10-23').candles).toEqual([
			['2026-10-01', 30, 35, 29, 34, 300],
		])
	})

	test('日线缺今天时用 ZXD 和实时 OHLCV 补当天，周月不补', () => {
		const entry = {
			...rows,
			ZXD: '2026/10/23',
			DOP: '12',
			DHP: '15',
			DLP: '11',
			DPP: '14',
			DV: '150',
		}
		expect(parseJpxCandles(response(entry), '151', 'day', '2026-10-23').candles).toEqual([
			['2026-10-22', 10, 13, 9, 12, 100],
			['2026-10-23', 12, 15, 11, 14, 150],
		])
		expect(parseJpxCandles(response(entry), '151', 'week', '2026-10-23').candles).toHaveLength(1)
	})

	test('当天元数据覆盖数组旧值；元数据不完整时保留数组新值', () => {
		const entry = {
			A_HISTDAYL: [['2026/10/23', '10', '13', '9', '12', '100']],
			ZXD: '2026/10/23',
			DOP: '11',
			DHP: '16',
			DLP: '10',
			DPP: '15',
			DV: '160',
		}
		expect(parseJpxCandles(response(entry), '151', 'day', '2026-10-23').candles).toEqual([
			['2026-10-23', 11, 16, 10, 15, 160],
		])
		expect(
			parseJpxCandles(response({ ...entry, DPP: '-' }), '151', 'day', '2026-10-23').candles,
		).toEqual([['2026-10-23', 10, 13, 9, 12, 100]])
	})

	test('坏行和非法日期被清洗，没有有效 K 线时抛错', () => {
		const entry = {
			A_HISTDAYL: [
				['2026/02/30', '1', '2', '1', '2', '1'],
				['2026/10/22', '1', '-', '1', '1', '1'],
			],
		}
		expect(() => parseJpxCandles(response(entry), '151', 'day', '2026-10-23')).toThrow(
			'no valid day rows',
		)
	})
})
