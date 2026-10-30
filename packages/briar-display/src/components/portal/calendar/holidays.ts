import {
	type CalendarDate,
	type CalendarHoliday,
	addDays,
	dateKey,
	fromUtcDate,
	toUtcDate,
} from './calendar'

export interface CalendarHolidayData {
	holidays: Record<string, CalendarHoliday>
	papers: string[]
}

const EMPTY_DATA: CalendarHolidayData = { holidays: {}, papers: [] }

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value)
}

function validDateKey(value: unknown, year: number) {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
	const [dateYear, month, day] = value.split('-').map(Number)
	const date = { year: dateYear, month, day }
	if (dateYear !== year || dateKey(fromUtcDate(toUtcDate(date))) !== value) return null
	return value
}

function dateFromKey(key: string): CalendarDate {
	const [year, month, day] = key.split('-').map(Number)
	return { year, month, day }
}

export function parseHolidayYear(payload: unknown, year: number) {
	if (!isRecord(payload) || !Array.isArray(payload.days)) return {}
	const days: { key: string; name: string; rest: boolean }[] = []
	for (const value of payload.days) {
		if (!isRecord(value) || typeof value.isOffDay !== 'boolean') continue
		const key = validDateKey(value.date, year)
		const name = typeof value.name === 'string' ? value.name.trim() : ''
		if (!key || !name) continue
		days.push({ key, name, rest: value.isOffDay })
	}
	days.sort((a, b) => a.key.localeCompare(b.key))

	const holidays: Record<string, CalendarHoliday> = {}
	for (let index = 0; index < days.length; index += 1) {
		const day = days[index]
		if (!day.rest) {
			holidays[day.key] = { label: day.name, kind: 'work', start: day.key, end: day.key }
			continue
		}

		let endIndex = index
		while (
			endIndex + 1 < days.length &&
			days[endIndex + 1].rest &&
			days[endIndex + 1].name === day.name &&
			days[endIndex + 1].key === dateKey(addDays(dateFromKey(days[endIndex].key), 1))
		) {
			endIndex += 1
		}
		for (let dayIndex = index; dayIndex <= endIndex; dayIndex += 1) {
			holidays[days[dayIndex].key] = {
				label: day.name,
				kind: 'rest',
				start: day.key,
				end: days[endIndex].key,
			}
		}
		index = endIndex
	}
	return holidays
}

function officialPapers(payload: unknown) {
	if (!isRecord(payload) || !Array.isArray(payload.papers)) return []
	return payload.papers.filter(
		(paper): paper is string =>
			typeof paper === 'string' && paper.startsWith('https://www.gov.cn/'),
	)
}

async function fetchHolidayFile(fileYear: number, year: number, signal: AbortSignal) {
	const path = `NateScarlet/holiday-cn@master/${fileYear}.json`
	const urls = [
		`https://fastly.jsdelivr.net/gh/${path}`,
		`https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${fileYear}.json`,
	]
	let lastError: unknown = new Error('节假日接口暂不可用')
	for (const url of urls) {
		try {
			const response = await fetch(url, { headers: { Accept: 'application/json' }, signal })
			if (response.status === 404) return EMPTY_DATA
			if (!response.ok) throw new Error(`节假日接口返回 ${response.status}`)
			const payload: unknown = await response.json()
			if (!isRecord(payload) || payload.year !== fileYear || !Array.isArray(payload.days)) {
				throw new Error('节假日接口响应格式不正确')
			}
			return { holidays: parseHolidayYear(payload, year), papers: officialPapers(payload) }
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') throw error
			lastError = error
		}
	}
	throw lastError
}

export async function fetchCalendarHolidays(
	year: number,
	signal: AbortSignal,
): Promise<CalendarHolidayData> {
	const nextYear = fetchHolidayFile(year + 1, year, signal).catch((error: unknown) => {
		if (error instanceof Error && error.name === 'AbortError') throw error
		return EMPTY_DATA
	})
	const current = await fetchHolidayFile(year, year, signal)
	const next = await nextYear
	return {
		holidays: { ...current.holidays, ...next.holidays },
		papers: [...new Set([...current.papers, ...next.papers])],
	}
}
