import { cn } from '@/lib/utils'
import { CalendarDays } from 'lucide-react'
import type { CalendarEvent } from '../calendarEventStore'
import { calendarAnnotation, lunarLabel } from '../calendarUtils'
import type { CalendarHoliday } from './calendar'

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

interface CalendarDayViewProps {
	date: Date
	today: Date
	events: CalendarEvent[]
	holiday?: CalendarHoliday
}

export function CalendarDayView({ date, today, events, holiday }: CalendarDayViewProps) {
	const annotation = calendarAnnotation(date)
	return (
		<section
			aria-label={`${date.getMonth() + 1} 月 ${date.getDate()} 日议程`}
			className="min-h-80 rounded-[10px] border border-[color:var(--rv-navy)]/15 bg-accent/10 p-4 sm:p-5"
		>
			<div className="flex items-start justify-between gap-3 border-b border-[color:var(--rv-navy)]/15 pb-4">
				<div>
					<p className="font-display text-3xl font-semibold tabular-nums">
						{date.getMonth() + 1} 月 {date.getDate()} 日
					</p>
					<p className="mt-1 text-sm text-muted-foreground">
						{WEEKDAYS[date.getDay()]} · 农历{' '}
						{lunarLabel(date.getFullYear(), date.getMonth() + 1, date.getDate())}
					</p>
				</div>
				{date.toDateString() === today.toDateString() && (
					<span className="rounded-full bg-[color:var(--rv-pink)] px-2.5 py-1 text-xs text-[color:var(--rv-rose-deep)]">
						今天
					</span>
				)}
			</div>

			{(holiday || annotation) && (
				<div className="mt-4 flex flex-wrap gap-2">
					{holiday && (
						<span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--rv-pink)] px-3 py-1.5 text-xs text-[color:var(--rv-rose-deep)]">
							<CalendarDays className="h-3.5 w-3.5" />
							{holiday.label}（{holiday.kind === 'rest' ? '休' : '班'}）
						</span>
					)}
					{annotation && (
						<span
							className={cn(
								'rounded-full px-3 py-1.5 text-xs',
								annotation.kind === 'festival'
									? 'bg-[color:var(--rv-pink)] text-[color:var(--rv-rose-deep)]'
									: 'bg-[color:var(--rv-sky)]/60 text-foreground/75',
							)}
						>
							{annotation.label} · {annotation.kind === 'festival' ? '节日' : '节气'}
						</span>
					)}
				</div>
			)}

			<div className="mt-5">
				<h3 className="text-sm font-medium">
					当天日程 <span className="ml-1 text-xs text-muted-foreground">{events.length} 项</span>
				</h3>
				{events.length === 0 ? (
					<p className="py-16 text-center text-sm text-muted-foreground">
						这一天还没有日程，可从日程面板添加
					</p>
				) : (
					<ol className="mt-3 space-y-2">
						{events.map((event) => (
							<li
								key={event.id}
								className="flex gap-3 rounded-[10px] border border-[color:var(--rv-navy)]/10 bg-[var(--rv-cream)] p-3"
							>
								<time className="w-12 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
									{event.time || '全天'}
								</time>
								<span className="break-words text-sm">{event.title}</span>
							</li>
						))}
					</ol>
				)}
			</div>
		</section>
	)
}
