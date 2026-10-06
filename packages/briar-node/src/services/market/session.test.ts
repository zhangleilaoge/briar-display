import { describe, expect, test } from 'bun:test'
import { getSessionStatus, zonedTimeToTs } from './session'

/** 2026-10-07 是周三（A股国庆休市期间），2026-10-12 周一 */
const at = (tz: string, y: number, mo: number, d: number, h: number, mi = 0) =>
	zonedTimeToTs(tz, y, mo, d, h, mi)

describe('交易时段（当地时间，含午休）', () => {
	test('A股：盘前 / 交易 / 午休 / 收盘 / 周末', () => {
		const tz = 'Asia/Shanghai'
		expect(getSessionStatus('cn', at(tz, 2026, 10, 12, 9, 0))).toBe('pre')
		expect(getSessionStatus('cn', at(tz, 2026, 10, 12, 10, 0))).toBe('open')
		expect(getSessionStatus('cn', at(tz, 2026, 10, 12, 12, 0))).toBe('break')
		expect(getSessionStatus('cn', at(tz, 2026, 10, 12, 14, 59))).toBe('open')
		expect(getSessionStatus('cn', at(tz, 2026, 10, 12, 15, 0))).toBe('closed')
		expect(getSessionStatus('cn', at(tz, 2026, 10, 11, 10, 0))).toBe('closed')
	})

	test('港股 16:00 后还有收市竞价，日本 12:30 复市、15:30 收盘', () => {
		expect(getSessionStatus('hk', at('Asia/Hong_Kong', 2026, 10, 12, 16, 5))).toBe('open')
		expect(getSessionStatus('hk', at('Asia/Hong_Kong', 2026, 10, 12, 12, 30))).toBe('break')
		expect(getSessionStatus('jp', at('Asia/Tokyo', 2026, 10, 12, 12, 0))).toBe('break')
		expect(getSessionStatus('jp', at('Asia/Tokyo', 2026, 10, 12, 15, 20))).toBe('open')
		expect(getSessionStatus('kr', at('Asia/Seoul', 2026, 10, 12, 12, 0))).toBe('open')
	})

	test('美股按美东时间（自动处理夏令时）', () => {
		expect(getSessionStatus('us', at('America/New_York', 2026, 7, 13, 10, 0))).toBe('open')
		expect(getSessionStatus('us', at('America/New_York', 2026, 12, 14, 10, 0))).toBe('open')
		expect(getSessionStatus('us', at('America/New_York', 2026, 12, 14, 16, 30))).toBe('closed')
	})

	test('节假日：时钟在交易时段但最近行情不是今天 → 休市；开盘头 30 分钟不校验', () => {
		const tz = 'Asia/Shanghai'
		const lastQuote = at(tz, 2026, 9, 30, 15, 0)
		expect(getSessionStatus('cn', at(tz, 2026, 10, 7, 10, 30), lastQuote)).toBe('closed')
		expect(getSessionStatus('cn', at(tz, 2026, 10, 7, 9, 40), lastQuote)).toBe('open')
		const todayQuote = at(tz, 2026, 10, 12, 10, 29)
		expect(getSessionStatus('cn', at(tz, 2026, 10, 12, 10, 30), todayQuote)).toBe('open')
	})
})

describe('zonedTimeToTs', () => {
	test('东京 / 纽约本地时间换算', () => {
		expect(new Date(zonedTimeToTs('Asia/Tokyo', 2026, 10, 6, 15, 30)).toISOString()).toBe(
			'2026-10-06T06:30:00.000Z',
		)
		expect(new Date(zonedTimeToTs('America/New_York', 2026, 10, 5, 16, 0, 1)).toISOString()).toBe(
			'2026-10-05T20:00:01.000Z',
		)
	})
})
