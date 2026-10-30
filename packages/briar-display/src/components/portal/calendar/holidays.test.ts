import { describe, expect, test } from 'bun:test'
import { parseHolidayYear } from './holidays'

describe('节假日接口解析', () => {
	test('将连续休息合并，并保留节日名称和补班', () => {
		const holidays = parseHolidayYear(
			{
				year: 2026,
				days: [
					{ name: '春节', date: '2026-02-14', isOffDay: false },
					{ name: '春节', date: '2026-02-15', isOffDay: true },
					{ name: '春节', date: '2026-02-16', isOffDay: true },
					{ name: '春节', date: '2026-02-17', isOffDay: true },
					{ name: '春节', date: '2026-02-18', isOffDay: true },
				],
			},
			2026,
		)
		expect(holidays['2026-02-14']).toEqual({
			label: '春节',
			kind: 'work',
			start: '2026-02-14',
			end: '2026-02-14',
		})
		expect(holidays['2026-02-17']).toEqual({
			label: '春节',
			kind: 'rest',
			start: '2026-02-15',
			end: '2026-02-18',
		})
		expect(holidays['2026-02-16']).toEqual(holidays['2026-02-18'])
	})

	test('不将非连续休息合成一个假期', () => {
		const holidays = parseHolidayYear(
			{
				year: 2026,
				days: [
					{ name: '劳动节', date: '2026-05-01', isOffDay: true },
					{ name: '劳动节', date: '2026-05-03', isOffDay: true },
				],
			},
			2026,
		)
		expect(holidays['2026-05-01']?.end).toBe('2026-05-01')
		expect(holidays['2026-05-03']?.start).toBe('2026-05-03')
	})

	test('剔除其他年份、无效日期和异常响应', () => {
		const holidays = parseHolidayYear(
			{
				year: 2026,
				days: [
					{ name: '元旦', date: '2025-01-01', isOffDay: true },
					{ name: '无效日期', date: '2026-02-30', isOffDay: true },
					{ name: '', date: '2026-03-01', isOffDay: true },
				],
			},
			2026,
		)
		expect(holidays).toEqual({})
		expect(parseHolidayYear(null, 2026)).toEqual({})
		expect(parseHolidayYear({ year: 2026 }, 2026)).toEqual({})
	})
})
