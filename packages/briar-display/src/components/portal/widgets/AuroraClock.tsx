'use client'

import { useEffect, useRef } from 'react'
import { WidgetChrome } from '../WidgetChrome'
import type { WidgetSize } from '../widgetTypes'
import './AuroraClock.css'

const formatter = new Intl.DateTimeFormat('en-US', {
	timeZone: 'Asia/Shanghai',
	hour: 'numeric',
	minute: 'numeric',
	second: 'numeric',
	hourCycle: 'h23',
})

export function AuroraClock({
	size,
	editing,
	onRemove,
}: {
	size: WidgetSize
	editing?: boolean
	onRemove?: () => void
}) {
	const hourRef = useRef<HTMLDivElement>(null)
	const minuteRef = useRef<HTMLDivElement>(null)
	const secondRef = useRef<HTMLDivElement>(null)
	const timeRef = useRef<HTMLTimeElement>(null)

	useEffect(() => {
		let frame: number | null = null
		const tick = () => {
			const parts = formatter.formatToParts(new Date())
			const read = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0)
			const hours = read('hour')
			const minutes = read('minute')
			const seconds = read('second')
			const milliseconds = Date.now() % 1000
			const time = [hours, minutes, seconds]
				.map((value) => String(value).padStart(2, '0'))
				.join(':')

			if (hourRef.current) {
				hourRef.current.style.transform = `rotate(${(hours % 12) * 30 + minutes * 0.5 + seconds * (0.5 / 60)}deg)`
			}
			if (minuteRef.current) {
				minuteRef.current.style.transform = `rotate(${minutes * 6 + seconds * 0.1}deg)`
			}
			if (secondRef.current) {
				secondRef.current.style.transform = `rotate(${seconds * 6 + milliseconds * 0.006}deg)`
			}
			if (timeRef.current && timeRef.current.textContent !== time) {
				timeRef.current.textContent = time
			}
			frame = requestAnimationFrame(tick)
		}
		const handleVisibility = () => {
			if (frame !== null) cancelAnimationFrame(frame)
			if (!document.hidden) tick()
		}
		tick()
		document.addEventListener('visibilitychange', handleVisibility)
		return () => {
			if (frame !== null) cancelAnimationFrame(frame)
			document.removeEventListener('visibilitychange', handleVisibility)
		}
	}, [])

	return (
		<WidgetChrome
			editing={editing}
			onRemove={onRemove}
			bodyClassName="flex flex-col items-center justify-center pt-3"
			tilt={0.8}
		>
			<div className={`aurora-clock ${size === '2x2' ? 'aurora-clock-large' : ''}`}>
				<div className="clock-face" aria-hidden>
					<div className="clock-dial">
						<div className="dial-texture" />
						{Array.from({ length: 12 }, (_, i) =>
							i % 3 === 0 ? null : (
								<div
									key={i}
									className="hour-marker"
									style={{ '--rot': `${i * 30}deg` } as React.CSSProperties}
								/>
							),
						)}
						<div className="clock-center" />
						<div ref={hourRef} className="hour-hand" />
						<div ref={minuteRef} className="minute-hand" />
						<div ref={secondRef} className="second-hand" />
						<div className="clock-numbers">
							{['XII', 'III', 'VI', 'IX'].map((number) => (
								<div key={number} className="number">
									{number}
								</div>
							))}
						</div>
					</div>
				</div>
				<time ref={timeRef} aria-label="上海时间" className="current-time" />
			</div>
		</WidgetChrome>
	)
}
