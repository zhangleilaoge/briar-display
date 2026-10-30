import { useEffect, useRef, useState } from 'react'
import { type CalendarHolidayData, fetchCalendarHolidays } from './holidays'

type HolidayStatus = 'loading' | 'ready' | 'error'
const EMPTY_DATA: CalendarHolidayData = { holidays: {}, papers: [] }

export function useCalendarHolidays(year: number) {
	const cache = useRef(new Map<number, CalendarHolidayData>())
	const [retryIndex, setRetryIndex] = useState(0)
	const [state, setState] = useState<{
		year: number
		data: CalendarHolidayData
		status: HolidayStatus
	}>({ year, data: EMPTY_DATA, status: 'loading' })

	useEffect(() => {
		const cached = cache.current.get(year)
		if (cached) {
			setState({ year, data: cached, status: 'ready' })
			return
		}
		const controller = new AbortController()
		const timeout = window.setTimeout(() => controller.abort(), 10000)
		setState({ year, data: EMPTY_DATA, status: 'loading' })
		fetchCalendarHolidays(year, controller.signal)
			.then((data) => {
				cache.current.set(year, data)
				setState({ year, data, status: 'ready' })
			})
			.catch((error: unknown) => {
				if (error instanceof Error && error.name === 'AbortError') return
				setState({ year, data: EMPTY_DATA, status: 'error' })
			})
			.finally(() => window.clearTimeout(timeout))
		return () => {
			window.clearTimeout(timeout)
			controller.abort()
		}
	}, [year, retryIndex])

	return {
		holidays: state.year === year ? state.data.holidays : {},
		papers: state.year === year ? state.data.papers : [],
		status: state.year === year ? state.status : ('loading' as HolidayStatus),
		retry: () => {
			cache.current.delete(year)
			setRetryIndex((value) => value + 1)
		},
	}
}
