'use client'

import { useEffect, useState } from 'react'
import { WidgetChrome } from '../WidgetChrome'
import type { WidgetSize } from '../widgetTypes'

/** 杭州 · Open-Meteo（免费公开 API，无需 key） */
const LAT = 30.2741
const LON = 120.1551
const URL = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FShanghai&forecast_days=1`

interface WeatherData {
	temp: number
	humidity: number
	wind: number
	code: number
	high: number
	low: number
}

function wmoLabel(code: number): { text: string; glyph: string } {
	if (code === 0) return { text: '晴', glyph: '☀' }
	if (code <= 3) return { text: '多云', glyph: '☁' }
	if (code <= 48) return { text: '雾', glyph: '〰' }
	if (code <= 57) return { text: '毛毛雨', glyph: '☂' }
	if (code <= 67) return { text: '雨', glyph: '☂' }
	if (code <= 77) return { text: '雪', glyph: '❄' }
	if (code <= 82) return { text: '阵雨', glyph: '☂' }
	if (code <= 86) return { text: '阵雪', glyph: '❄' }
	if (code <= 99) return { text: '雷暴', glyph: '⚡' }
	return { text: '天气', glyph: '·' }
}

export function WeatherWidget({
	size,
	editing,
	onRemove,
}: {
	size: WidgetSize
	editing?: boolean
	onRemove?: () => void
}) {
	const [data, setData] = useState<WeatherData | null>(null)
	const [err, setErr] = useState(false)

	useEffect(() => {
		let cancelled = false
		;(async () => {
			try {
				const res = await fetch(URL)
				if (!res.ok) throw new Error('weather')
				const json = await res.json()
				if (cancelled) return
				setData({
					temp: json.current.temperature_2m,
					humidity: json.current.relative_humidity_2m,
					wind: json.current.wind_speed_10m,
					code: json.current.weather_code,
					high: json.daily.temperature_2m_max[0],
					low: json.daily.temperature_2m_min[0],
				})
			} catch {
				if (!cancelled) setErr(true)
			}
		})()
		return () => {
			cancelled = true
		}
	}, [])

	const compact = size === '1x1'
	const meta = data ? wmoLabel(data.code) : null

	return (
		<WidgetChrome
			title={compact ? undefined : '杭州'}
			caption={compact ? undefined : 'Météo'}
			editing={editing}
			onRemove={onRemove}
			bodyClassName="flex flex-col justify-center"
			tilt={-0.4}
		>
			{err && <p className="text-center text-sm text-muted-foreground">暂时读不到天气，稍后再试</p>}
			{!err && !data && <p className="text-center text-sm text-muted-foreground">加载中…</p>}
			{data && meta && (
				<div className={compact ? 'flex flex-col items-center gap-0.5' : 'space-y-2'}>
					{compact ? (
						<>
							<span className="text-2xl" aria-hidden>
								{meta.glyph}
							</span>
							<p className="font-display text-2xl font-semibold tabular-nums">
								{Math.round(data.temp)}°
							</p>
							<p className="text-[11px] text-muted-foreground">杭州 · {meta.text}</p>
						</>
					) : (
						<>
							<div className="flex items-end justify-between gap-2">
								<div>
									<p className="font-display text-4xl font-semibold tabular-nums leading-none">
										{Math.round(data.temp)}°
									</p>
									<p className="mt-1 text-sm text-muted-foreground">
										<span aria-hidden className="mr-1">
											{meta.glyph}
										</span>
										{meta.text}
									</p>
								</div>
								<div className="text-right text-xs text-muted-foreground tabular-nums">
									<p>
										高 {Math.round(data.high)}° · 低 {Math.round(data.low)}°
									</p>
									<p className="mt-0.5">湿度 {data.humidity}%</p>
									<p>风 {Math.round(data.wind)} km/h</p>
								</div>
							</div>
						</>
					)}
				</div>
			)}
		</WidgetChrome>
	)
}
