import { describe, expect, test } from 'bun:test'
import type { Candle, MinuteDay } from '@briar/shared'
import { buildMinuteRows, formatVolume, movingAverage, shiftedLabel, tzOffsetMs } from './chartData'

/** 东京 2026-10-06 hh:mm 的时间戳（东京无夏令时，UTC+9） */
const tk = (h: number, m: number, d = 6) => Date.UTC(2026, 9, d, h - 9, m)

describe('走势面板数据', () => {
	test('时区偏移：东京 +9h，纽约夏令时 -4h', () => {
		expect(tzOffsetMs(tk(9, 0), 'Asia/Tokyo')).toBe(9 * 3600_000)
		expect(tzOffsetMs(Date.UTC(2026, 9, 5, 14), 'America/New_York')).toBe(-4 * 3600_000)
	})

	test('分钟行：时间平移为当地墙上时间，稀疏分钟用上一笔补，未来分钟补空白，午休不占位', () => {
		const day: MinuteDay = {
			date: '2026-10-06',
			prevClose: 100,
			sessions: [
				[tk(9, 0), tk(9, 3)],
				[tk(12, 30), tk(12, 31)],
			],
			points: [
				[tk(9, 0), 101, 10],
				[tk(9, 2), 99, 5],
			],
		}
		const rows = buildMinuteRows([day], 'Asia/Tokyo')
		expect(rows.map((r) => shiftedLabel(r.time, 'time'))).toEqual([
			'09:00',
			'09:01',
			'09:02',
			'09:03',
			'12:30',
			'12:31',
		])
		expect(rows.map((r) => r.price)).toEqual([101, 101, 99, undefined, undefined, undefined])
		expect(rows[1].vol).toBe(0)
		expect(rows.map((r) => r.up).slice(0, 3)).toEqual([true, true, false])
	})

	test('五日：只有最后一天补未来空白，往日收盘后的空档不补', () => {
		const mk = (d: number, last: number): MinuteDay => ({
			date: `2026-10-0${d}`,
			prevClose: null,
			sessions: [[tk(9, 0, d), tk(9, 2, d)]],
			points: [[tk(9, 0, d), last, null]],
		})
		const rows = buildMinuteRows([mk(5, 10), mk(6, 11)], 'Asia/Tokyo')
		expect(rows.map((r) => [r.date, r.price])).toEqual([
			['2026-10-05', 10],
			['2026-10-06', 11],
			['2026-10-06', undefined],
			['2026-10-06', undefined],
		])
	})

	test('均线与成交量格式', () => {
		const candles: Candle[] = [1, 2, 3, 4, 5, 6].map((c, i) => [`2026-10-0${i + 1}`, c, c, c, c, 1])
		expect(movingAverage(candles, 5)).toEqual([null, null, null, null, 3, 4])
		expect(formatVolume(123456789)).toBe('1.23亿')
		expect(formatVolume(56789)).toBe('5.7万')
		expect(formatVolume(null)).toBe('--')
	})
})
