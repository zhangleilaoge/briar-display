import { cn } from '@/lib/utils'
import { isSameDay, isSameMonth, startOfMonth } from 'date-fns'
import type { CalendarEvent } from '../calendarEventStore'
import { calendarAnnotation, getMonthGrid, toDateKey } from '../calendarUtils'
import type { CalendarHoliday } from './calendar'
import { getCalendarYear } from './calendarView'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

interface CalendarYearViewProps {
	selected: Date
	today: Date
	events: CalendarEvent[]
	holidays: Record<string, CalendarHoliday>
	onOpenMonth: (date: Date) => void
}

export function CalendarYearView({
	selected,
	today,
	events,
	holidays,
	onOpenMonth,
}: CalendarYearViewProps) {
	return (
		<section
			aria-label={`${selected.getFullYear()} 年年历`}
			className="grid grid-cols-2 gap-3 sm:grid-cols-3"
		>
			{getCalendarYear(selected).map((month) => (
				<div
					key={month.getMonth()}
					className="rounded-[10px] border border-[color:var(--rv-navy)]/15 bg-accent/10 p-2.5"
				>
					<button
						type="button"
						onClick={() => onOpenMonth(startOfMonth(month))}
						className="mb-2 rounded-md px-1 font-display text-base font-semibold outline-none hover:text-[color:var(--rv-rose-deep)] focus-visible:ring-2 focus-visible:ring-[color:var(--rv-rose-deep)]"
						aria-label={`打开 ${month.getMonth() + 1} 月月历`}
					>
						{month.getMonth() + 1} 月
					</button>
					<div className="grid grid-cols-7 text-center text-[9px] text-muted-foreground">
						{WEEKDAYS.map((weekday) => (
							<span key={weekday} className="pb-1">
								{weekday}
							</span>
						))}
					</div>
					<div className="grid grid-cols-7 gap-y-0.5">
						{getMonthGrid(month).map((date) => {
							const key = toDateKey(date)
							const annotated = !!calendarAnnotation(date) || !!holidays[key]
							const hasEvents = events.some((event) => event.date === key)
							return (
								<button
									key={key}
									type="button"
									onClick={() => onOpenMonth(date)}
									aria-label={`打开 ${date.getFullYear()} 年 ${date.getMonth() + 1} 月月历，选择 ${date.getDate()} 日${annotated ? '，有节日或休班安排' : ''}${hasEvents ? '，有日程' : ''}`}
									className={cn(
										'relative flex h-6 min-w-0 items-center justify-center rounded-full text-[10px] tabular-nums outline-none hover:bg-[color:var(--rv-pink)] focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[color:var(--rv-rose-deep)]',
										!isSameMonth(date, month) && 'text-muted-foreground/35',
										isSameDay(date, selected) &&
											'bg-[color:var(--rv-pink)] text-[color:var(--rv-rose-deep)] ring-1 ring-[color:var(--rv-rose-deep)]',
										isSameDay(date, today) &&
											'bg-[color:var(--rv-rose-deep)] font-semibold text-[var(--rv-cream)]',
									)}
								>
									{date.getDate()}
									{(annotated || hasEvents) && (
										<span
											className={cn(
												'absolute bottom-0 h-0.5 w-0.5 rounded-full',
												annotated ? 'bg-[color:var(--rv-rose-deep)]' : 'bg-[color:var(--rv-navy)]',
											)}
										/>
									)}
								</button>
							)
						})}
					</div>
				</div>
			))}
		</section>
	)
}
