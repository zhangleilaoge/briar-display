export const CALENDAR_TIME_ZONE = 'Asia/Shanghai'

export interface CalendarDate {
	year: number
	month: number
	day: number
}

export interface CalendarAnnotation {
	label: string
	kind: 'festival' | 'solar-term'
}

export interface CalendarHoliday {
	label: string
	kind: 'rest' | 'work'
	start: string
	end: string
}

export interface CalendarCell extends CalendarDate {
	key: string
	inMonth: boolean
	lunar: string
	annotation: CalendarAnnotation | null
}

export const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const SOLAR_TERMS = [
	'小寒',
	'大寒',
	'立春',
	'雨水',
	'惊蛰',
	'春分',
	'清明',
	'谷雨',
	'立夏',
	'小满',
	'芒种',
	'夏至',
	'小暑',
	'大暑',
	'立秋',
	'处暑',
	'白露',
	'秋分',
	'寒露',
	'霜降',
	'立冬',
	'小雪',
	'大雪',
	'冬至',
]

const SOLAR_TERM_MINUTES = [
	0, 21208, 42467, 63836, 85337, 107014, 128867, 150921, 173149, 195551, 218072, 240693, 263343,
	285989, 308563, 331033, 353350, 375494, 397447, 419210, 440795, 462224, 483532, 504758,
]

const SOLAR_FESTIVALS: Record<string, string> = {
	'01-01': '元旦',
	'03-08': '妇女节',
	'03-12': '植树节',
	'05-01': '劳动节',
	'06-01': '儿童节',
	'09-10': '教师节',
	'10-01': '国庆节',
}

const LUNAR_FESTIVALS: Record<string, string> = {
	'正月-1': '春节',
	'正月-15': '元宵节',
	'五月-5': '端午节',
	'七月-7': '七夕节',
	'八月-15': '中秋节',
	'九月-9': '重阳节',
	'腊月-8': '腊八节',
}

const LUNAR_DAY_NAMES = [
	'',
	'初一',
	'初二',
	'初三',
	'初四',
	'初五',
	'初六',
	'初七',
	'初八',
	'初九',
	'初十',
	'十一',
	'十二',
	'十三',
	'十四',
	'十五',
	'十六',
	'十七',
	'十八',
	'十九',
	'二十',
	'廿一',
	'廿二',
	'廿三',
	'廿四',
	'廿五',
	'廿六',
	'廿七',
	'廿八',
	'廿九',
	'三十',
]

function pad(value: number) {
	return String(value).padStart(2, '0')
}

export function dateKey(date: CalendarDate) {
	return `${date.year}-${pad(date.month)}-${pad(date.day)}`
}

export function sameDate(a: CalendarDate, b: CalendarDate) {
	return a.year === b.year && a.month === b.month && a.day === b.day
}

export function toUtcDate(date: CalendarDate) {
	return new Date(Date.UTC(date.year, date.month - 1, date.day, 4))
}

export function fromUtcDate(date: Date): CalendarDate {
	return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }
}

export function addDays(date: CalendarDate, amount: number): CalendarDate {
	const next = toUtcDate(date)
	next.setUTCDate(next.getUTCDate() + amount)
	return fromUtcDate(next)
}

export function addMonths(date: CalendarDate, amount: number): CalendarDate {
	const monthIndex = date.year * 12 + date.month - 1 + amount
	const year = Math.floor(monthIndex / 12)
	const month = (((monthIndex % 12) + 12) % 12) + 1
	const day = Math.min(date.day, new Date(Date.UTC(year, month, 0)).getUTCDate())
	return { year, month, day }
}

export function shanghaiToday(now = new Date()): CalendarDate {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: CALENDAR_TIME_ZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).formatToParts(now)
	const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
	return { year: get('year'), month: get('month'), day: get('day') }
}

function lunarParts(date: CalendarDate) {
	try {
		const parts = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
			timeZone: CALENDAR_TIME_ZONE,
			month: 'long',
			day: 'numeric',
		}).formatToParts(toUtcDate(date))
		return {
			month: parts.find((part) => part.type === 'month')?.value ?? '',
			day: Number(parts.find((part) => part.type === 'day')?.value),
		}
	} catch {
		return { month: '', day: 0 }
	}
}

export function lunarLabel(date: CalendarDate) {
	const lunar = lunarParts(date)
	if (lunar.day === 1 && lunar.month) return lunar.month
	return LUNAR_DAY_NAMES[lunar.day] ?? ''
}

export function lunarFullLabel(date: CalendarDate) {
	const lunar = lunarParts(date)
	return `${lunar.month}${LUNAR_DAY_NAMES[lunar.day] ?? ''}`
}

function solarTerm(year: number, month: number, day: number): string | null {
	if (year < 1901 || year > 2100) return null
	const index = (month - 1) * 2 + (day > 15 ? 1 : 0)
	const timestamp =
		Date.UTC(1900, 0, 6, 2, 5) + 31556925974.7 * (year - 1900) + SOLAR_TERM_MINUTES[index] * 60000
	return new Date(timestamp).getUTCDate() === day ? SOLAR_TERMS[index] : null
}

export function calendarAnnotation(date: CalendarDate): CalendarAnnotation | null {
	const lunar = lunarParts(date)
	const lunarFestival = LUNAR_FESTIVALS[`${lunar.month}-${lunar.day}`]
	if (lunarFestival) return { label: lunarFestival, kind: 'festival' }

	const tomorrow = lunarParts(addDays(date, 1))
	if (tomorrow.month === '正月' && tomorrow.day === 1) {
		return { label: '除夕', kind: 'festival' }
	}

	const solarFestival = SOLAR_FESTIVALS[`${pad(date.month)}-${pad(date.day)}`]
	if (solarFestival) return { label: solarFestival, kind: 'festival' }

	const term = solarTerm(date.year, date.month, date.day)
	return term ? { label: term, kind: 'solar-term' } : null
}

export function buildMonthCells(year: number, month: number): CalendarCell[] {
	const first = { year, month, day: 1 }
	const firstWeekday = toUtcDate(first).getUTCDay()
	const start = addDays(first, -firstWeekday)
	return Array.from({ length: 42 }, (_, index) => {
		const date = addDays(start, index)
		return {
			...date,
			key: dateKey(date),
			inMonth: date.month === month && date.year === year,
			lunar: lunarLabel(date),
			annotation: calendarAnnotation(date),
		}
	})
}

export function weekdayLabel(date: CalendarDate) {
	return WEEKDAYS[toUtcDate(date).getUTCDay()]
}
