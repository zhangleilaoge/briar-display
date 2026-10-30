import { describe, expect, test } from 'bun:test'
import {
	addDays,
	addMonths,
	buildMonthCells,
	calendarAnnotation,
	lunarFullLabel,
	lunarLabel,
} from './calendar'

describe('日历日期计算', () => {
	test('月视图始终包含完整六周及相邻月份', () => {
		const cells = buildMonthCells(2026, 10)
		expect(cells).toHaveLength(42)
		expect(cells[0]).toMatchObject({ key: '2026-09-27', inMonth: false })
		expect(cells[41]).toMatchObject({ key: '2026-11-07', inMonth: false })
		expect(cells.filter((cell) => cell.inMonth)).toHaveLength(31)
	})

	test('跨日跨月保留真实日期并处理月末', () => {
		expect(addDays({ year: 2026, month: 10, day: 31 }, 1)).toEqual({
			year: 2026,
			month: 11,
			day: 1,
		})
		expect(addMonths({ year: 2025, month: 1, day: 31 }, 1)).toEqual({
			year: 2025,
			month: 2,
			day: 28,
		})
		expect(addMonths({ year: 2026, month: 1, day: 31 }, -2)).toEqual({
			year: 2025,
			month: 11,
			day: 30,
		})
	})
})

describe('农历、节日与节气', () => {
	test('显示完整农历和月首日名称', () => {
		expect(lunarLabel({ year: 2026, month: 10, day: 1 })).toBe('廿一')
		expect(lunarFullLabel({ year: 2026, month: 10, day: 1 })).toBe('八月廿一')
		expect(lunarLabel({ year: 2026, month: 2, day: 17 })).toBe('正月')
	})

	test('自动识别农历节日和除夕', () => {
		expect(calendarAnnotation({ year: 2026, month: 2, day: 16 })).toEqual({
			label: '除夕',
			kind: 'festival',
		})
		expect(calendarAnnotation({ year: 2026, month: 2, day: 17 })?.label).toBe('春节')
		expect(calendarAnnotation({ year: 2026, month: 9, day: 25 })?.label).toBe('中秋节')
		expect(calendarAnnotation({ year: 2026, month: 10, day: 18 })?.label).toBe('重阳节')
	})

	test('自动识别公历节日和二十四节气', () => {
		expect(calendarAnnotation({ year: 2026, month: 10, day: 1 })).toEqual({
			label: '国庆节',
			kind: 'festival',
		})
		expect(calendarAnnotation({ year: 2026, month: 10, day: 8 })).toEqual({
			label: '寒露',
			kind: 'solar-term',
		})
		expect(calendarAnnotation({ year: 2026, month: 10, day: 23 })?.label).toBe('霜降')
		expect(calendarAnnotation({ year: 2026, month: 11, day: 7 })?.label).toBe('立冬')
		expect(calendarAnnotation({ year: 2026, month: 10, day: 30 })).toBeNull()
	})
})
