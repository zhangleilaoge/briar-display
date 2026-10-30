import { describe, expect, test } from 'bun:test'
import {
	CALENDAR_VIEWS,
	calendarViewTitle,
	getCalendarWeek,
	getCalendarYear,
	isCalendarView,
	moveCalendarDate,
} from './calendarView'

describe('日历视图', () => {
	test('只接受日周月年四种视图', () => {
		expect(CALENDAR_VIEWS).toEqual(['day', 'week', 'month', 'year'])
		for (const view of CALENDAR_VIEWS) expect(isCalendarView(view)).toBe(true)
		expect(isCalendarView('schedule')).toBe(false)
	})

	test('前后导航按当前视图移动真实日期', () => {
		const date = new Date(2026, 0, 31, 12)
		expect(moveCalendarDate(date, 'day', 1)).toEqual(new Date(2026, 1, 1, 12))
		expect(moveCalendarDate(date, 'week', 1)).toEqual(new Date(2026, 1, 7, 12))
		expect(moveCalendarDate(date, 'month', 1)).toEqual(new Date(2026, 1, 28, 12))
		expect(moveCalendarDate(date, 'year', -1)).toEqual(new Date(2025, 0, 31, 12))
	})

	test('周视图从周日开始并完整覆盖跨月一周', () => {
		const week = getCalendarWeek(new Date(2026, 9, 1, 12))
		expect(week.map((date) => date.getDate())).toEqual([27, 28, 29, 30, 1, 2, 3])
		expect(week.map((date) => date.getDay())).toEqual([0, 1, 2, 3, 4, 5, 6])
	})

	test('年视图包含当年十二个月', () => {
		const months = getCalendarYear(new Date(2026, 9, 30, 12))
		expect(months.map((month) => month.getFullYear())).toEqual(Array(12).fill(2026))
		expect(months.map((month) => month.getMonth())).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
		expect(months.every((month) => month.getDate() === 1)).toBe(true)
	})

	test('标题随视图显示对应日期粒度', () => {
		const date = new Date(2026, 9, 30, 12)
		expect(calendarViewTitle(date, 'day')).toBe('2026 年 10 月 30 日')
		expect(calendarViewTitle(date, 'week')).toBe('2026 年 10 月')
		expect(calendarViewTitle(date, 'month')).toBe('2026 年 10 月')
		expect(calendarViewTitle(date, 'year')).toBe('2026 年')
	})
})
