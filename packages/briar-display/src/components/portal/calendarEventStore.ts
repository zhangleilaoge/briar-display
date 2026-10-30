export interface CalendarEvent {
	id: string
	date: string
	title: string
	time: string
}

const STORAGE_KEY = 'briar_portal_calendar_events_v1'
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function parseCalendarEvents(raw: string | null): CalendarEvent[] {
	if (!raw) return []
	try {
		const value: unknown = JSON.parse(raw)
		if (!Array.isArray(value)) return []
		return value.flatMap((item): CalendarEvent[] => {
			if (!item || typeof item !== 'object') return []
			const event = item as Record<string, unknown>
			if (
				typeof event.id !== 'string' ||
				typeof event.date !== 'string' ||
				!DATE_KEY.test(event.date) ||
				typeof event.title !== 'string' ||
				!event.title.trim() ||
				event.title.length > 80 ||
				typeof event.time !== 'string' ||
				(event.time !== '' && !TIME.test(event.time))
			) {
				return []
			}
			return [
				{
					id: event.id,
					date: event.date,
					title: event.title.trim(),
					time: event.time,
				},
			]
		})
	} catch {
		return []
	}
}

export function loadCalendarEvents(): CalendarEvent[] {
	try {
		return parseCalendarEvents(window.localStorage.getItem(STORAGE_KEY))
	} catch {
		return []
	}
}

export function saveCalendarEvents(events: CalendarEvent[]) {
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
	} catch {
		/* 存储不可用时仍保留当前页面内的日程 */
	}
}
