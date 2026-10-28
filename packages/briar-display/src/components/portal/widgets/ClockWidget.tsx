'use client'

import { useEffect, useState } from 'react'
import { WidgetChrome } from '../WidgetChrome'
import type { WidgetSize } from '../widgetTypes'

const TZ = 'Asia/Shanghai'

function readNow() {
	const d = new Date()
	const time = new Intl.DateTimeFormat('zh-CN', {
		timeZone: TZ,
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23',
	}).format(d)
	const date = new Intl.DateTimeFormat('zh-CN', {
		timeZone: TZ,
		month: 'long',
		day: 'numeric',
		weekday: 'short',
	}).format(d)
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: TZ,
		hour: 'numeric',
		minute: 'numeric',
		second: 'numeric',
		hourCycle: 'h23',
	}).formatToParts(d)
	const n = (t: string) => Number(parts.find((p) => p.type === t)?.value || 0)
	return { time, date, h: n('hour'), m: n('minute'), s: n('second') }
}

export function ClockWidget({
	size,
	editing,
	onRemove,
}: {
	size: WidgetSize
	editing?: boolean
	onRemove?: () => void
}) {
	const [now, setNow] = useState<ReturnType<typeof readNow> | null>(null)
	useEffect(() => {
		setNow(readNow())
		const id = window.setInterval(() => setNow(readNow()), 1000)
		return () => clearInterval(id)
	}, [])

	const analog = size === '2x2'
	const h = now?.h ?? 0
	const m = now?.m ?? 0
	const s = now?.s ?? 0
	const hDeg = ((h % 12) + m / 60) * 30
	const mDeg = (m + s / 60) * 6
	const sDeg = s * 6

	return (
		<WidgetChrome
			title={analog ? undefined : '时钟'}
			caption={analog ? undefined : 'Horloge'}
			editing={editing}
			onRemove={onRemove}
			bodyClassName="flex flex-col items-center justify-center gap-1"
			tilt={0.8}
		>
			{!now ? (
				<div className="text-sm text-muted-foreground">…</div>
			) : analog ? (
				<>
					<div className="relative aspect-square w-[72%] max-w-[9.5rem]">
						<svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
							<circle
								cx="50"
								cy="50"
								r="48"
								fill="color-mix(in srgb, var(--rv-pink) 35%, white)"
								stroke="color-mix(in srgb, var(--rv-navy) 28%, transparent)"
								strokeWidth="1.5"
							/>
							{Array.from({ length: 12 }).map((_, i) => {
								const a = ((i + 1) / 12) * Math.PI * 2 - Math.PI / 2
								const x = 50 + Math.cos(a) * 38
								const y = 50 + Math.sin(a) * 38
								return (
									<circle
										key={i}
										cx={x}
										cy={y}
										r={i % 3 === 2 ? 1.6 : 1}
										fill="var(--rv-navy)"
										opacity={0.45}
									/>
								)
							})}
							<line
								x1="50"
								y1="50"
								x2={50 + Math.sin((hDeg * Math.PI) / 180) * 22}
								y2={50 - Math.cos((hDeg * Math.PI) / 180) * 22}
								stroke="var(--rv-ink)"
								strokeWidth="3"
								strokeLinecap="round"
								className="motion-reduce:transition-none"
							/>
							<line
								x1="50"
								y1="50"
								x2={50 + Math.sin((mDeg * Math.PI) / 180) * 30}
								y2={50 - Math.cos((mDeg * Math.PI) / 180) * 30}
								stroke="var(--rv-navy)"
								strokeWidth="2"
								strokeLinecap="round"
							/>
							<line
								x1="50"
								y1="50"
								x2={50 + Math.sin((sDeg * Math.PI) / 180) * 34}
								y2={50 - Math.cos((sDeg * Math.PI) / 180) * 34}
								stroke="var(--rv-rose-deep)"
								strokeWidth="1"
								strokeLinecap="round"
								className="motion-reduce:hidden"
							/>
							<circle cx="50" cy="50" r="2.2" fill="var(--rv-rose-deep)" />
						</svg>
					</div>
					<p className="font-heading text-sm font-semibold tabular-nums">{now.time.slice(0, 5)}</p>
					<p className="text-[11px] text-muted-foreground">{now.date}</p>
				</>
			) : (
				<>
					<p className="font-display text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">
						{now.time.slice(0, 5)}
					</p>
					<p className="text-xs text-muted-foreground">{now.date}</p>
				</>
			)}
		</WidgetChrome>
	)
}
