import { describe, expect, it } from 'bun:test'
import { getMonthGrid, toDateKey } from './calendarUtils'

describe('calendarUtils', () => {
	it('始终生成从周日开始的六周月历', () => {
		const days = getMonthGrid(new Date(2026, 9, 1, 12))
		expect(days).toHaveLength(42)
		expect(days[0].getDay()).toBe(0)
		expect(toDateKey(days[0])).toBe('2026-09-27')
		expect(toDateKey(days[41])).toBe('2026-11-07')
	})

	it('日期键使用本地日历日并补零', () => {
		expect(toDateKey(new Date(2027, 0, 5, 23, 59))).toBe('2027-01-05')
	})
})
