import { addDays, startOfMonth } from 'date-fns'

const TZ = 'Asia/Shanghai'

export interface CalendarDateParts {
	year: number
	month: number
	day: number
}

export function shanghaiParts(date = new Date()): CalendarDateParts {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: TZ,
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

/** 简易农历月日，用于桌面与月历辅助展示 */
export function lunarLabel(year: number, month: number, day: number): string {
	try {
		const date = new Date(Date.UTC(year, month - 1, day, 4))
		return new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
			timeZone: TZ,
			month: 'long',
			day: 'numeric',
		})
			.format(date)
			.replace(/年/, '')
	} catch {
		return ''
	}
}
