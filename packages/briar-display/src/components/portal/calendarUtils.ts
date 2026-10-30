import { addDays, startOfMonth } from 'date-fns'
import {
	CALENDAR_TIME_ZONE,
	type CalendarDate,
	calendarAnnotation as annotationForDate,
	lunarLabel as lunarDayLabel,
	lunarFullLabel,
} from './calendar/calendar'

export interface CalendarDateParts {
	year: number
	month: number
	day: number
}

export function shanghaiParts(date = new Date()): CalendarDateParts {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: CALENDAR_TIME_ZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).formatToParts(date)
	const get = (type: string) => parts.find((part) => part.type === type)?.value || ''
	return { year: Number(get('year')), month: Number(get('month')), day: Number(get('day')) }
}

export function shanghaiDate(): Date {
	const { year, month, day } = shanghaiParts()
	return new Date(year, month - 1, day, 12)
}

export function getMonthGrid(month: Date): Date[] {
	const first = startOfMonth(month)
	const start = addDays(first, -first.getDay())
	return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

export function toDateKey(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${date.getFullYear()}-${month}-${day}`
}

export function dateParts(date: Date): CalendarDate {
	return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
}

export function lunarLabel(year: number, month: number, day: number): string {
	return lunarFullLabel({ year, month, day })
}

export function lunarDay(date: Date): string {
	return lunarDayLabel(dateParts(date))
}

export function calendarAnnotation(date: Date) {
	return annotationForDate(dateParts(date))
}
