import { cn } from '@/lib/utils'
import { isSameDay } from 'date-fns'
import type { KeyboardEvent } from 'react'
import type { CalendarEvent } from '../calendarEventStore'
import { calendarAnnotation, lunarDay, toDateKey } from '../calendarUtils'
import type { CalendarHoliday } from './calendar'
import { getCalendarWeek } from './calendarView'

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

interface CalendarWeekViewProps {
	selected: Date
	today: Date
	events: CalendarEvent[]
	holidays: Record<string, CalendarHoliday>
	onSelect: (date: Date) => void
	onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, date: Date) => void
}

export function CalendarWeekView({
	selected,
	today,
	events,
	holidays,
	onSelect,
	onKeyDown,
}: CalendarWeekViewProps) {
	return (
		<section aria-label="周日程">
			<div className="overflow-x-auto rounded-[10px] border border-[color:var(--rv-navy)]/15">
				<div className="grid min-w-[38rem] grid-cols-7">
					{getCalendarWeek(selected).map((date, index) => {
						const key = toDateKey(date)
						const dayEvents = events.filter((event) => event.date === key)
						const holiday = holidays[key]
						const annotation = calendarAnnotation(date)
						const isSelected = isSameDay(date, selected)
						return (
							<div
								key={key}
								className={cn(
									'min-h-72 border-r border-[color:var(--rv-navy)]/15 last:border-r-0',
									isSelected && 'bg-[color:var(--rv-pink)]/25',
								)}
							>
								<button
									type="button"
									data-calendar-date={key}
									aria-pressed={isSelected}
									aria-current={isSameDay(date, today) ? 'date' : undefined}
									onClick={() => onSelect(date)}
									onKeyDown={(event) => onKeyDown(event, date)}
									className={cn(
										'w-full border-b border-[color:var(--rv-navy)]/15 p-2.5 text-left outline-none transition-colors hover:bg-[color:var(--rv-pink)]/35 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--rv-rose-deep)]',
										isSelected && 'bg-[color:var(--rv-pink)]/45',
									)}
								>
									<span className="text-xs text-muted-foreground">{WEEKDAYS[index]}</span>
									<span className="mt-1 flex items-center justify-between gap-1">
										<span
											className={cn(
												'flex h-7 min-w-7 items-center justify-center rounded-full px-1 font-display text-lg tabular-nums',
												isSameDay(date, today) &&
													'bg-[color:var(--rv-rose-deep)] font-semibold text-[var(--rv-cream)]',
											)}
										>
											{date.getDate()}
										</span>
										<span className="truncate text-[10px] text-muted-foreground">
											{lunarDay(date)}
										</span>
									</span>
								</button>
								<div className="space-y-1.5 p-1.5">
									{holiday && (
										<p className="rounded-md bg-[color:var(--rv-pink)] px-1.5 py-1 text-[10px] text-[color:var(--rv-rose-deep)]">
											{holiday.label}（{holiday.kind === 'rest' ? '休' : '班'}）
										</p>
									)}
									{annotation && (
										<p className="rounded-md bg-[color:var(--rv-pink)]/70 px-1.5 py-1 text-[10px] text-[color:var(--rv-rose-deep)]">
											{annotation.label}
										</p>
									)}
									{dayEvents.map((event) => (
										<div key={event.id} className="rounded-md bg-secondary px-1.5 py-1 text-[10px]">
											<time className="block tabular-nums text-muted-foreground">
												{event.time || '全天'}
											</time>
											<span className="mt-0.5 block break-words">{event.title}</span>
										</div>
									))}
								</div>
							</div>
						)
					})}
				</div>
			</div>
			<p className="mt-2 text-[11px] text-muted-foreground sm:hidden">左右滑动查看完整一周</p>
		</section>
	)
}
