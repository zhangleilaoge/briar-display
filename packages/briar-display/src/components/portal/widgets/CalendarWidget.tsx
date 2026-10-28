'use client'

import { useEffect, useMemo, useState } from 'react'
import { WidgetChrome } from '../WidgetChrome'
import type { WidgetSize } from '../widgetTypes'

const TZ = 'Asia/Shanghai'
const WEEK = ['日', '一', '二', '三', '四', '五', '六']

function shanghaiParts(d = new Date()) {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: TZ,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		weekday: 'short',
	}).formatToParts(d)
	const get = (t: string) => parts.find((p) => p.type === t)?.value || ''
	return {
		year: Number(get('year')),
		month: Number(get('month')),
		day: Number(get('day')),
	}
}

/** 简易农历月日（近似展示用，足够桌面点缀） */
function lunarLabel(year: number, month: number, day: number): string {
	try {
		const fmt = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
			timeZone: TZ,
			month: 'long',
			day: 'numeric',
		})
		// 用上海正午避免跨日边界
		const dt = new Date(Date.UTC(year, month - 1, day, 4, 0, 0))
		return fmt.format(dt).replace(/年/, '')
	} catch {
		return ''
	}
}

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

	return (
		<WidgetChrome
			editing={editing}
			onRemove={onRemove}
			bodyClassName="flex flex-col !pt-2.5"
			tilt={-0.6}
		>
			{!today ? (
				<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
					…
				</div>
			) : (
				<>
					<div className="mb-2 flex items-baseline gap-2 px-0.5">
						<span className="font-heading text-lg font-semibold text-[color:var(--rv-rose-deep)] sm:text-xl">
							{today.month}月
						</span>
						{lunar && <span className="truncate text-xs text-muted-foreground">{lunar}</span>}
					</div>
					<div className="grid grid-cols-7 gap-y-0.5 text-center">
						{WEEK.map((w) => (
							<span key={w} className="text-[10px] text-muted-foreground sm:text-[11px]">
								{w}
							</span>
						))}
						{cells.map((c, i) => {
							const isToday = !!c && c.day === today.day
							return (
								<span
									key={i}
									className={
										isToday
											? 'mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--rv-rose-deep)] text-[11px] font-semibold text-[var(--rv-cream)] sm:h-7 sm:w-7 sm:text-xs'
											: 'mx-auto flex h-6 w-6 items-center justify-center text-[11px] tabular-nums text-foreground/85 sm:h-7 sm:w-7 sm:text-xs'
									}
								>
									{c?.day ?? ''}
								</span>
							)
						})}
					</div>
				</>
			)}
		</WidgetChrome>
	)
}
