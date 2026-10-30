'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDialog } from '../CalendarDialog'
import { WidgetChrome } from '../WidgetChrome'
import { lunarLabel, shanghaiParts } from '../calendarUtils'
import type { WidgetSize } from '../widgetTypes'

const WEEK = ['日', '一', '二', '三', '四', '五', '六']

export function CalendarWidget({
	size,
	editing,
	onRemove,
}: {
	size: WidgetSize
	editing?: boolean
	onRemove?: () => void
}) {
	const [today, setToday] = useState<{ year: number; month: number; day: number } | null>(null)
	const [calendarOpen, setCalendarOpen] = useState(false)
	useEffect(() => {
		setToday(shanghaiParts())
	}, [])

	const cells = useMemo(() => {
		if (!today) return []
		const { year, month } = today
		// 用 UTC 构造「本地日历」格子：上海月日与 UTC 日对齐在正午足够稳
		const firstWeekday = new Date(Date.UTC(year, month - 1, 1, 4)).getUTCDay()
		const daysInMonth = new Date(Date.UTC(year, month, 0, 4)).getUTCDate()
		const out: ({ day: number; inMonth: boolean } | null)[] = []
		for (let i = 0; i < firstWeekday; i++) out.push(null)
		for (let d = 1; d <= daysInMonth; d++) out.push({ day: d, inMonth: true })
		while (out.length % 7 !== 0) out.push(null)
		return out
	}, [today])

	const lunar = today ? lunarLabel(today.year, today.month, today.day) : ''
	const compact = size === '1x1'

	return (
		<>
			<CalendarDialog open={calendarOpen} onOpenChange={setCalendarOpen} />
			<WidgetChrome
				editing={editing}
				onRemove={onRemove}
				bodyClassName="flex flex-col !pt-2.5"
				tilt={-0.6}
			>
				<button
					type="button"
					data-widget-action
					disabled={editing}
					aria-label="打开日历"
					aria-haspopup="dialog"
					className="h-full w-full cursor-pointer rounded-[var(--radius-control)] text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-grab"
					onClick={() => {
						if (!editing) setCalendarOpen(true)
					}}
				>
					{!today ? (
						<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
							…
						</div>
					) : (
						<>
							<div
								className={`flex shrink-0 items-baseline gap-2 px-0.5 ${compact ? 'mb-1' : 'mb-2'}`}
							>
								<span
									className={
										compact
											? 'font-heading text-base font-semibold text-[color:var(--rv-rose-deep)]'
											: 'font-heading text-lg font-semibold text-[color:var(--rv-rose-deep)] sm:text-xl'
									}
								>
									{today.month}月
								</span>
								{lunar && !compact && (
									<span className="truncate text-xs text-muted-foreground">{lunar}</span>
								)}
							</div>
							<div
								className={`grid grid-cols-7 text-center ${compact ? 'gap-y-0' : 'min-h-0 flex-1 gap-y-0.5'}`}
								style={
									compact
										? undefined
										: { gridTemplateRows: `auto repeat(${cells.length / 7}, minmax(0, 1fr))` }
								}
							>
								{WEEK.map((w) => (
									<span
										key={w}
										className={
											compact
												? 'text-[9px] text-muted-foreground'
												: 'text-[10px] text-muted-foreground sm:text-[11px]'
										}
									>
										{w}
									</span>
								))}
								{cells.map((c, i) => {
									const isToday = !!c && c.day === today.day
									const cell = compact
										? isToday
											? 'mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--rv-rose-deep)] text-[10px] font-semibold text-[var(--rv-cream)]'
											: 'mx-auto flex h-5 w-5 items-center justify-center text-[10px] tabular-nums text-foreground/85'
										: isToday
											? 'mx-auto flex aspect-square h-full max-h-7 w-auto items-center justify-center rounded-full bg-[color:var(--rv-rose-deep)] text-[11px] font-semibold text-[var(--rv-cream)] sm:text-xs'
											: 'mx-auto flex aspect-square h-full max-h-7 w-auto items-center justify-center text-[11px] tabular-nums text-foreground/85 sm:text-xs'
									return (
										<span key={i} className={cell}>
											{c?.day ?? ''}
										</span>
									)
								})}
							</div>
						</>
					)}
				</button>
			</WidgetChrome>
		</>
	)
}
