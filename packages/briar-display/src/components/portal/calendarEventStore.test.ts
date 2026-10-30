import { describe, expect, it } from 'bun:test'
import { parseCalendarEvents } from './calendarEventStore'

describe('parseCalendarEvents', () => {
	it('保留有效日程并过滤损坏数据', () => {
		const events = parseCalendarEvents(
			JSON.stringify([
				{ id: '1', date: '2026-10-30', title: '  评审  ', time: '14:30' },
				{ id: '2', date: '2026-10-30', title: '', time: '' },
				{ id: '3', date: 'invalid', title: '无效日期', time: '' },
				null,
			]),
		)
		expect(events).toEqual([{ id: '1', date: '2026-10-30', title: '评审', time: '14:30' }])
	})

	it('无法解析时返回空列表', () => {
		expect(parseCalendarEvents(null)).toEqual([])
		expect(parseCalendarEvents('{')).toEqual([])
		expect(parseCalendarEvents('{}')).toEqual([])
	})
})
