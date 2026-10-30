import { cn } from '@/lib/utils'
import { addDays } from 'date-fns'
import type { KeyboardEvent } from 'react'
import type { CalendarEvent } from '../calendarEventStore'
import { calendarAnnotation, lunarDay, lunarLabel, toDateKey } from '../calendarUtils'
import type { CalendarHoliday } from './calendar'

interface CalendarDayCellProps {
	date: Date
	index: number
	inMonth: boolean
	selected: boolean
	today: boolean
	events: CalendarEvent[]
	holidays: Record<string, CalendarHoliday>
	onSelect: (date: Date) => void
	onKeyDown: (event: KeyboardEvent<HTMLButtonElement>, date: Date) => void
}

function HolidayMarker({
	date,
	holiday,
	holidays,
}: {
	date: Date
	holiday: CalendarHoliday
	holidays: Record<string, CalendarHoliday>
}) {
	const rest = holiday.kind === 'rest'
	const previous = holidays[toDateKey(addDays(date, -1))]
	const next = holidays[toDateKey(addDays(date, 1))]
	const continuesPrevious = rest && date.getDay() !== 0 && previous?.kind === 'rest'
	const continuesNext = rest && date.getDay() !== 6 && next?.kind === 'rest'
	return (
		<span
			className={cn(
				'relative z-[1] flex shrink-0 items-center gap-1 rounded-full sm:h-3.5 sm:w-auto sm:self-stretch sm:px-1 sm:text-[10px] sm:leading-3',
				rest
					? 'h-1.5 self-stretch bg-[color:var(--rv-rose-deep)] text-[color:var(--rv-rose-deep)] sm:bg-[color:var(--rv-pink)]'
					: 'h-2 w-2 self-center bg-[color:var(--rv-navy)] text-foreground/75 sm:bg-secondary sm:text-secondary-foreground',
				continuesPrevious && '-ml-1.5 rounded-l-none sm:-ml-2',
				continuesNext && '-mr-1.5 rounded-r-none sm:-mr-2',
			)}
		>
			{!continuesPrevious && (
				<>
					<span className="hidden h-1 w-1 shrink-0 rounded-full bg-current sm:block" />
					<span className="hidden truncate sm:inline">
						{holiday.label}（{rest ? '休' : '班'}）
					</span>
				</>
			)}
		</span>
	)
}

export function CalendarDayCell({
	date,
	index,
	inMonth,
	selected,
	today,
	events,
	holidays,
	onSelect,
	onKeyDown,
}: CalendarDayCellProps) {
	const dateKey = toDateKey(date)
	const annotation = calendarAnnotation(date)
	const holiday = holidays[dateKey]
	const visibleEvents = events.slice(0, Number(!annotation) + Number(!holiday))
	const totalItems = events.length + Number(!!annotation) + Number(!!holiday)
	const shownItems = visibleEvents.length + Number(!!annotation) + Number(!!holiday)
	return (
		<button
			type="button"
			data-calendar-date={dateKey}
			aria-label={`${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日，农历${lunarLabel(date.getFullYear(), date.getMonth() + 1, date.getDate())}${annotation ? `，${annotation.label}` : ''}${holiday ? `，${holiday.kind === 'rest' ? `${holiday.label}放假` : '调休上班'}` : ''}，${events.length}项日程`}
			aria-pressed={selected}
			aria-current={today ? 'date' : undefined}
			onClick={() => onSelect(date)}
			onKeyDown={(event) => onKeyDown(event, date)}
			className={cn(
				'relative flex min-h-14 min-w-0 flex-col gap-0.5 border-b border-r border-[color:var(--rv-navy)]/15 p-1.5 text-left align-top outline-none transition-colors hover:bg-[color:var(--rv-pink)]/35 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--rv-rose-deep)] sm:min-h-20 sm:p-2',
				(index + 1) % 7 === 0 && 'border-r-0',
				index >= 35 && 'border-b-0',
				!inMonth && 'bg-muted/25 text-muted-foreground/60',
				selected &&
					'bg-[color:var(--rv-pink)]/45 ring-2 ring-inset ring-[color:var(--rv-rose-deep)]',
			)}
		>
			<span className="flex min-w-0 shrink-0 items-start justify-between gap-0.5">
				<span
					className={cn(
						'hidden truncate pt-1 text-[10px] text-muted-foreground sm:block',
						annotation && 'text-[color:var(--rv-rose-deep)]',
					)}
				>
					{lunarDay(date)}
				</span>
				<span
					className={cn(
						'ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-sm tabular-nums',
						today && 'bg-[color:var(--rv-rose-deep)] font-semibold text-[var(--rv-cream)]',
					)}
				>
					{date.getDate()}
				</span>
			</span>
			{holiday && <HolidayMarker date={date} holiday={holiday} holidays={holidays} />}
			{annotation && (
				<span
					className={cn(
						'flex h-2 w-2 shrink-0 items-center gap-1 self-center rounded-full sm:h-3.5 sm:w-full sm:min-w-0 sm:self-auto sm:px-1 sm:text-[10px] sm:leading-3',
						annotation.kind === 'festival'
							? 'bg-[color:var(--rv-rose-deep)] text-[color:var(--rv-rose-deep)] sm:bg-[color:var(--rv-pink)]'
							: 'bg-[color:var(--rv-navy)] text-foreground/75 sm:bg-[color:var(--rv-sky)]',
					)}
				>
					<span className="hidden h-1 w-1 shrink-0 rounded-full bg-current sm:block" />
					<span className="hidden truncate sm:inline">{annotation.label}</span>
				</span>
			)}
			{visibleEvents.map((item) => (
				<span
					key={item.id}
					className="flex h-2 w-2 shrink-0 items-center gap-1 self-center rounded-full bg-[color:var(--rv-navy)] sm:h-3.5 sm:w-full sm:min-w-0 sm:self-auto sm:rounded-md sm:bg-secondary sm:px-1 sm:text-[10px] sm:leading-3 sm:text-secondary-foreground"
				>
					<span className="hidden shrink-0 tabular-nums text-muted-foreground sm:inline">
						{item.time || '全天'}
					</span>
					<span className="hidden truncate sm:inline">{item.title}</span>
				</span>
			))}
			{totalItems > shownItems && (
				<span className="hidden shrink-0 px-1 text-[9px] leading-3 text-muted-foreground sm:block">
					还有 {totalItems - shownItems} 项
				</span>
			)}
		</button>
	)
}
