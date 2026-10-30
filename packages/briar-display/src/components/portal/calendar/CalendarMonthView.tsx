import { isSameDay, isSameMonth } from 'date-fns'
import type { KeyboardEvent } from 'react'
import type { CalendarEvent } from '../calendarEventStore'
import { getMonthGrid, toDateKey } from '../calendarUtils'
import { CalendarDayCell } from './CalendarDayCell'
import type { CalendarHoliday } from './calendar'

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

interface CalendarMonthViewProps {
	month: Date
	selected: Date
	today: Date
	events: CalendarEvent[]
	holidays: Record<string, CalendarHoliday>
	onSelect: (date: Date) => void
	onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, date: Date) => void
}

export function CalendarMonthView({
	month,
	selected,
	today,
	events,
	holidays,
	onSelect,
	onKeyDown,
}: CalendarMonthViewProps) {
	return (
		<section aria-label={`${month.getFullYear()} 年 ${month.getMonth() + 1} 月月历`}>
			<div className="grid grid-cols-7 rounded-t-[10px] border border-b-0 border-[color:var(--rv-navy)]/15 bg-accent/35">
				{WEEKDAYS.map((weekday) => (
					<div
						key={weekday}
						className="px-1 py-2 text-center text-xs font-medium text-muted-foreground"
					>
						{weekday}
					</div>
				))}
			</div>
			<div className="grid grid-cols-7 overflow-hidden rounded-b-[10px] border border-[color:var(--rv-navy)]/15">
				{getMonthGrid(month).map((date, index) => {
					const dateKey = toDateKey(date)
					return (
						<CalendarDayCell
							key={dateKey}
							date={date}
							index={index}
							inMonth={isSameMonth(date, month)}
							selected={isSameDay(date, selected)}
							today={isSameDay(date, today)}
							events={events.filter((event) => event.date === dateKey)}
							holidays={holidays}
							onSelect={onSelect}
							onKeyDown={onKeyDown}
						/>
					)
				})}
			</div>
		</section>
	)
}
