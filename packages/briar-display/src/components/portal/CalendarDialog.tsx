'use client'

import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { addDays, addMonths, isSameDay, isSameMonth, startOfMonth } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useState } from 'react'
import { type CalendarEvent, loadCalendarEvents, saveCalendarEvents } from './calendarEventStore'
import { getMonthGrid, lunarLabel, shanghaiDate, toDateKey } from './calendarUtils'

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

interface CalendarDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

export function CalendarDialog({ open, onOpenChange }: CalendarDialogProps) {
	const [month, setMonth] = useState(() => startOfMonth(shanghaiDate()))
	const [selected, setSelected] = useState(() => shanghaiDate())
	const [events, setEvents] = useState<CalendarEvent[]>([])
	const [title, setTitle] = useState('')
	const [time, setTime] = useState('')
	const today = shanghaiDate()
	const days = useMemo(() => getMonthGrid(month), [month])
	const selectedKey = toDateKey(selected)
	const eventDates = useMemo(() => new Set(events.map((event) => event.date)), [events])
	const selectedEvents = useMemo(
		() =>
			events
				.filter((event) => event.date === selectedKey)
				.sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00')),
		[events, selectedKey],
	)

	useEffect(() => {
		if (open) setEvents(loadCalendarEvents())
	}, [open])

	const selectDate = (date: Date) => {
		setSelected(date)
		if (!isSameMonth(date, month)) setMonth(startOfMonth(date))
	}

	const goToday = () => {
		const date = shanghaiDate()
		setSelected(date)
		setMonth(startOfMonth(date))
	}

	const moveSelection = (event: KeyboardEvent<HTMLButtonElement>, offset: number) => {
		event.preventDefault()
		selectDate(addDays(selected, offset))
	}

	const handleGridKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		const offsets: Partial<Record<string, number>> = {
			ArrowLeft: -1,
			ArrowRight: 1,
			ArrowUp: -7,
			ArrowDown: 7,
		}
		const offset = offsets[event.key]
		if (offset !== undefined) moveSelection(event, offset)
	}

	const addEvent = (event: FormEvent) => {
		event.preventDefault()
		const trimmed = title.trim()
		if (!trimmed) return
		const next = [...events, { id: crypto.randomUUID(), date: selectedKey, title: trimmed, time }]
		setEvents(next)
		saveCalendarEvents(next)
		setTitle('')
		setTime('')
	}

	const removeEvent = (id: string) => {
		const next = events.filter((event) => event.id !== id)
		setEvents(next)
		saveCalendarEvents(next)
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-[calc(100%-1rem)] max-w-5xl gap-0">
				<DialogHeader className="shrink-0">
					<DialogTitle>CALENDRIER · 日历</DialogTitle>
					<DialogDescription className="text-white/70">
						选择日期查看日程，方向键也可移动日期。
					</DialogDescription>
				</DialogHeader>

				<div className="min-h-0 overflow-y-auto">
					<div className="mb-4 flex flex-wrap items-end justify-between gap-3">
						<div>
							<p className="font-display text-2xl font-semibold tabular-nums sm:text-3xl">
								{month.getFullYear()} 年 {month.getMonth() + 1} 月
							</p>
							<p className="mt-1 text-xs text-muted-foreground">日程仅保存在当前浏览器</p>
						</div>
						<div className="flex items-center gap-2">
							<Button
								type="button"
								variant="default"
								size="icon"
								aria-label="上个月"
								onClick={() => setMonth((current) => addMonths(current, -1))}
							>
								<ChevronLeft className="h-4 w-4" />
							</Button>
							<Button type="button" variant="default" onClick={goToday}>
								今天
							</Button>
							<Button
								type="button"
								variant="default"
								size="icon"
								aria-label="下个月"
								onClick={() => setMonth((current) => addMonths(current, 1))}
							>
								<ChevronRight className="h-4 w-4" />
							</Button>
						</div>
					</div>

					<div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_15rem]">
						<section aria-label={`${month.getFullYear()} 年 ${month.getMonth() + 1} 月月历`}>
							<div className="grid grid-cols-7 rounded-t-[var(--radius-control)] border border-b-0 border-[color:var(--rv-navy)]/15 bg-accent/35">
								{WEEKDAYS.map((weekday) => (
									<div
										key={weekday}
										className="px-1 py-2 text-center text-xs font-medium text-muted-foreground"
									>
										{weekday}
									</div>
								))}
							</div>
							<div className="grid grid-cols-7 overflow-hidden rounded-b-[var(--radius-control)] border border-[color:var(--rv-navy)]/15">
								{days.map((date, index) => {
									const dateKey = toDateKey(date)
									const isSelected = isSameDay(date, selected)
									const isToday = isSameDay(date, today)
									return (
										<button
											key={dateKey}
											type="button"
											aria-label={`${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日${eventDates.has(dateKey) ? '，有日程' : ''}`}
											aria-pressed={isSelected}
											aria-current={isToday ? 'date' : undefined}
											onClick={() => selectDate(date)}
											onKeyDown={handleGridKeyDown}
											className={cn(
												'relative min-h-14 border-b border-r border-[color:var(--rv-navy)]/15 p-1.5 text-left align-top outline-none transition-colors hover:bg-accent/45 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:min-h-20 sm:p-2',
												(index + 1) % 7 === 0 && 'border-r-0',
												index >= 35 && 'border-b-0',
												!isSameMonth(date, month) && 'bg-muted/25 text-muted-foreground/60',
												isSelected && 'bg-accent/65 ring-2 ring-inset ring-primary',
											)}
										>
											<span
												className={cn(
													'flex h-6 w-6 items-center justify-center rounded-full text-sm tabular-nums',
													isToday &&
														'bg-[color:var(--rv-rose-deep)] font-semibold text-[var(--rv-cream)]',
												)}
											>
												{date.getDate()}
											</span>
											<span className="mt-0.5 hidden truncate text-[10px] text-muted-foreground sm:block">
												{lunarLabel(date.getFullYear(), date.getMonth() + 1, date.getDate())}
											</span>
											{eventDates.has(dateKey) && (
												<span
													aria-hidden
													className="absolute bottom-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary"
												/>
											)}
										</button>
									)
								})}
							</div>
						</section>

						<aside className="flex min-h-48 flex-col rounded-[var(--radius-control)] border border-[color:var(--rv-navy)]/15 bg-accent/20 p-3.5 md:border-l md:pl-4">
							<div className="border-b border-[color:var(--rv-navy)]/15 pb-3">
								<p className="font-display text-lg font-semibold tabular-nums">
									{selected.getMonth() + 1} 月 {selected.getDate()} 日
								</p>
								<p className="mt-0.5 text-xs text-muted-foreground">
									{WEEKDAYS[selected.getDay()]} ·{' '}
									{lunarLabel(selected.getFullYear(), selected.getMonth() + 1, selected.getDate())}
								</p>
							</div>

							<div className="min-h-20 flex-1 py-3">
								{selectedEvents.length === 0 ? (
									<p className="py-5 text-center text-sm text-muted-foreground">这一天还没有日程</p>
								) : (
									<ul className="space-y-2" aria-label="当天日程">
										{selectedEvents.map((event) => (
											<li
												key={event.id}
												className="group flex items-start gap-2 rounded-[var(--radius-control)] border border-[color:var(--rv-navy)]/10 bg-[var(--rv-cream)] p-2"
											>
												<div className="min-w-0 flex-1">
													<p className="text-xs tabular-nums text-muted-foreground">
														{event.time || '全天'}
													</p>
													<p className="break-words text-sm">{event.title}</p>
												</div>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="h-7 w-7 shrink-0"
													aria-label={`删除日程 ${event.title}`}
													onClick={() => removeEvent(event.id)}
												>
													<Trash2 className="h-3.5 w-3.5" />
												</Button>
											</li>
										))}
									</ul>
								)}
							</div>

							<form
								className="space-y-2 border-t border-[color:var(--rv-navy)]/15 pt-3"
								onSubmit={addEvent}
							>
								<Input
									value={title}
									onChange={(event) => setTitle(event.target.value)}
									placeholder="添加日程"
									aria-label="日程内容"
									maxLength={80}
									required
								/>
								<div className="flex gap-2">
									<Input
										type="time"
										value={time}
										onChange={(event) => setTime(event.target.value)}
										aria-label="日程时间，不填为全天"
										className="min-w-0 flex-1"
									/>
									<Button type="submit" size="icon" aria-label="添加日程" disabled={!title.trim()}>
										<Plus className="h-4 w-4" />
									</Button>
								</div>
							</form>
						</aside>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
