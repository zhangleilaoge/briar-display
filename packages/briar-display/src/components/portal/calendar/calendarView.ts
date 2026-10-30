import { addDays, addMonths, addYears, startOfMonth, startOfWeek } from 'date-fns'

export const CALENDAR_VIEWS = ['day', 'week', 'month', 'year'] as const
export type CalendarView = (typeof CALENDAR_VIEWS)[number]

export function isCalendarView(value: string): value is CalendarView {
	return CALENDAR_VIEWS.includes(value as CalendarView)
}

export function moveCalendarDate(date: Date, view: CalendarView, direction: number) {
	if (view === 'day') return addDays(date, direction)
	if (view === 'week') return addDays(date, direction * 7)
	if (view === 'month') return addMonths(date, direction)
	return addYears(date, direction)
}

export function getCalendarWeek(date: Date) {
	const start = startOfWeek(date, { weekStartsOn: 0 })
	return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

export function getCalendarYear(date: Date) {
	return Array.from({ length: 12 }, (_, index) =>
		startOfMonth(new Date(date.getFullYear(), index, 1)),
	)
}

export function calendarViewTitle(date: Date, view: CalendarView) {
	const year = date.getFullYear()
	if (view === 'year') return `${year} 年`
	if (view === 'day') return `${year} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`
	return `${year} 年 ${date.getMonth() + 1} 月`
}
