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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { addDays, addMonths, startOfMonth } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CalendarDayView } from './calendar/CalendarDayView'
import { CalendarMonthView } from './calendar/CalendarMonthView'
import { CalendarWeekView } from './calendar/CalendarWeekView'
import { CalendarYearView } from './calendar/CalendarYearView'
import {
	type CalendarView,
	calendarViewTitle,
	isCalendarView,
	moveCalendarDate,
} from './calendar/calendarView'
import { useCalendarHolidays } from './calendar/useCalendarHolidays'
import { type CalendarEvent, loadCalendarEvents, saveCalendarEvents } from './calendarEventStore'
import { calendarAnnotation, lunarLabel, shanghaiDate, toDateKey } from './calendarUtils'

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const VIEW_LABELS: { value: CalendarView; label: string }[] = [
	{ value: 'day', label: '日' },
	{ value: 'week', label: '周' },
	{ value: 'month', label: '月' },
	{ value: 'year', label: '年' },
]

interface CalendarDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

function holidayDateLabel(key: string) {
	const [, month, day] = key.split('-').map(Number)
	return `${month}月${day}日`
}

export function CalendarDialog({ open, onOpenChange }: CalendarDialogProps) {
	const [month, setMonth] = useState(() => startOfMonth(shanghaiDate()))
	const [selected, setSelected] = useState(() => shanghaiDate())
	const [view, setView] = useState<CalendarView>('month')
	const [events, setEvents] = useState<CalendarEvent[]>([])
	const [title, setTitle] = useState('')
	const [time, setTime] = useState('')
	const gridRef = useRef<HTMLDivElement>(null)
	const today = shanghaiDate()
	const selectedKey = toDateKey(selected)
	const {
		holidays,
		papers,
		status: holidayStatus,
		retry: retryHolidays,
	} = useCalendarHolidays(month.getFullYear())
	const selectedAnnotation = calendarAnnotation(selected)
	const selectedHoliday = holidays[selectedKey]
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
		setMonth(startOfMonth(date))
	}

	const goToday = () => {
		selectDate(shanghaiDate())
	}

	const handleGridKeyDown = (event: KeyboardEvent<HTMLButtonElement>, date: Date) => {
		let next: Date | undefined
		if (event.key === 'ArrowLeft') next = addDays(date, -1)
		if (event.key === 'ArrowRight') next = addDays(date, 1)
		if (event.key === 'ArrowUp') next = addDays(date, -7)
		if (event.key === 'ArrowDown') next = addDays(date, 7)
		if (event.key === 'PageUp') next = addMonths(date, -1)
		if (event.key === 'PageDown') next = addMonths(date, 1)
		if (!next) return
		event.preventDefault()
		selectDate(next)
		window.requestAnimationFrame(() => {
			gridRef.current
				?.querySelector<HTMLButtonElement>(
					`[data-state="active"] [data-calendar-date="${toDateKey(next)}"]`,
				)
				?.focus()
		})
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
		toast.success('日程已添加')
	}

	const removeEvent = (id: string) => {
		const next = events.filter((event) => event.id !== id)
		setEvents(next)
		saveCalendarEvents(next)
		toast.success('日程已删除')
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
					<Tabs
						value={view}
						onValueChange={(value) => {
							if (isCalendarView(value)) setView(value)
						}}
					>
						<div className="mb-2 flex justify-center px-4 pt-2">
							<TabsList aria-label="日历视图">
								{VIEW_LABELS.map((item, index) => (
									<TabsTrigger
										key={item.value}
										value={item.value}
										aria-label={`${item.label}视图`}
										className="min-w-12"
									>
										<span aria-hidden className="text-[9px] font-normal opacity-45">
											0{index + 1}
										</span>
										{item.label}
									</TabsTrigger>
								))}
							</TabsList>
						</div>
						<div className="mb-4 flex flex-wrap items-end justify-between gap-3">
							<div>
								<p
									className="font-display text-2xl font-semibold tabular-nums sm:text-3xl"
									aria-live="polite"
								>
									{calendarViewTitle(selected, view)}
								</p>
								<p className="mt-1 text-xs text-muted-foreground">日程仅保存在当前浏览器</p>
							</div>
							<div className="flex items-center gap-2">
								<Button
									type="button"
									variant="default"
									size="icon"
									aria-label="上一时间段"
									onClick={() => selectDate(moveCalendarDate(selected, view, -1))}
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
									aria-label="下一时间段"
									onClick={() => selectDate(moveCalendarDate(selected, view, 1))}
								>
									<ChevronRight className="h-4 w-4" />
								</Button>
							</div>
						</div>

						<div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_15rem]">
							<div ref={gridRef} className="min-w-0">
								<TabsContent
									value="day"
									className="mt-0 focus-visible:ring-[color:var(--rv-rose-deep)]"
								>
									<CalendarDayView
										date={selected}
										today={today}
										events={selectedEvents}
										holiday={selectedHoliday}
									/>
								</TabsContent>
								<TabsContent
									value="week"
									className="mt-0 focus-visible:ring-[color:var(--rv-rose-deep)]"
								>
									<CalendarWeekView
										selected={selected}
										today={today}
										events={events}
										holidays={holidays}
										onSelect={selectDate}
										onKeyDown={handleGridKeyDown}
									/>
								</TabsContent>
								<TabsContent
									value="month"
									className="mt-0 focus-visible:ring-[color:var(--rv-rose-deep)]"
								>
									<CalendarMonthView
										month={month}
										selected={selected}
										today={today}
										events={events}
										holidays={holidays}
										onSelect={selectDate}
										onKeyDown={handleGridKeyDown}
									/>
								</TabsContent>
								<TabsContent
									value="year"
									className="mt-0 focus-visible:ring-[color:var(--rv-rose-deep)]"
								>
									<CalendarYearView
										selected={selected}
										today={today}
										events={events}
										holidays={holidays}
										onOpenMonth={(date) => {
											selectDate(date)
											setView('month')
										}}
									/>
								</TabsContent>
								{holidayStatus === 'loading' && (
									<p className="mt-2 text-[11px] text-muted-foreground">正在更新放假调休…</p>
								)}
								{holidayStatus === 'error' && (
									<div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
										<span>放假调休暂不可用，节日与节气不受影响。</span>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="h-6 shrink-0 px-2 text-[11px]"
											onClick={retryHolidays}
										>
											重试
										</Button>
									</div>
								)}
							</div>

							<aside className="flex min-h-48 flex-col rounded-[10px] border border-[color:var(--rv-navy)]/15 bg-accent/20 p-3.5 md:border-l md:pl-4">
								<div className="border-b border-[color:var(--rv-navy)]/15 pb-3">
									<p className="font-display text-lg font-semibold tabular-nums">
										{selected.getMonth() + 1} 月 {selected.getDate()} 日
									</p>
									<p className="mt-0.5 text-xs text-muted-foreground">
										{WEEKDAYS[selected.getDay()]} · 农历{' '}
										{lunarLabel(
											selected.getFullYear(),
											selected.getMonth() + 1,
											selected.getDate(),
										)}
									</p>
								</div>

								{(selectedAnnotation || selectedHoliday) && (
									<div className="mt-3 space-y-2">
										{selectedHoliday && (
											<div className="rounded-[10px] bg-[color:var(--rv-pink)] px-2.5 py-2 text-xs text-[color:var(--rv-rose-deep)]">
												<p className="flex items-center gap-1.5 font-medium">
													<CalendarDays className="h-3.5 w-3.5 shrink-0" />
													{selectedHoliday.label}（{selectedHoliday.kind === 'rest' ? '休' : '班'}）
												</p>
												<p className="mt-1 flex items-center justify-between gap-2 pl-5 text-[10px] opacity-75">
													<span>
														{selectedHoliday.kind === 'work'
															? '调休上班'
															: selectedHoliday.start === selectedHoliday.end
																? '放假'
																: `${holidayDateLabel(selectedHoliday.start)}–${holidayDateLabel(selectedHoliday.end)}`}
													</span>
													{papers[0] && (
														<a
															href={papers[0]}
															target="_blank"
															rel="noreferrer"
															className="shrink-0 underline underline-offset-2"
														>
															官方安排
														</a>
													)}
												</p>
											</div>
										)}
										{selectedAnnotation && (
											<div
												className={cn(
													'flex items-center gap-1.5 rounded-[10px] px-2.5 py-2 text-xs',
													selectedAnnotation.kind === 'festival'
														? 'bg-[color:var(--rv-pink)] text-[color:var(--rv-rose-deep)]'
														: 'bg-[color:var(--rv-sky)]/60 text-foreground/75',
												)}
											>
												<CalendarDays className="h-3.5 w-3.5 shrink-0" />
												<span>{selectedAnnotation.label}</span>
												<span className="ml-auto text-[10px] opacity-70">
													{selectedAnnotation.kind === 'festival' ? '节日' : '节气'}
												</span>
											</div>
										)}
									</div>
								)}

								<div className="min-h-20 flex-1 py-3">
									{selectedEvents.length === 0 ? (
										<p className="py-5 text-center text-sm text-muted-foreground">
											这一天还没有日程
										</p>
									) : (
										<ul className="space-y-2" aria-label="当天日程">
											{selectedEvents.map((event) => (
												<li
													key={event.id}
													className="group flex items-start gap-2 rounded-[10px] border border-[color:var(--rv-navy)]/10 bg-[var(--rv-cream)] p-2"
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
										<Button
											type="submit"
											size="icon"
											aria-label="添加日程"
											disabled={!title.trim()}
										>
											<Plus className="h-4 w-4" />
										</Button>
									</div>
								</form>
							</aside>
						</div>
					</Tabs>
				</div>
			</DialogContent>
		</Dialog>
	)
}
