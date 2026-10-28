'use client'

import { Button } from '@/components/ui/button'
import { prefersReducedMotion } from '@/components/ui/motion'
import { cn } from '@/lib/utils'
import { LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { WidgetChrome } from '../WidgetChrome'
import { WeatherDialog } from '../weather/WeatherDialog'
import { WeatherIcon } from '../weather/WeatherIcon'
import {
	type WeatherForecast,
	type WeatherLocation,
	upcomingHours,
	windLabel,
	wmoInfo,
} from '../weather/weather'
import { getWeatherForecast } from '../weather/weatherApi'
import { useWeatherLocations } from '../weather/weatherLocationStore'
import type { WidgetSize } from '../widgetTypes'

const REFRESH_MS = 10 * 60_000
const ROTATE_MS = 6_000

function WeatherCardContent({
	location,
	forecast,
	size,
}: {
	location: WeatherLocation
	forecast: WeatherForecast
	size: WidgetSize
}) {
	const { current } = forecast
	const today = forecast.daily[0]
	const meta = wmoInfo(current.code, current.isDay)
	if (size === '1x1') {
		return (
			<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-0.5 text-center">
				<WeatherIcon code={current.code} isDay={current.isDay} className="h-5 w-5" />
				<p className="font-display text-2xl font-semibold leading-tight tabular-nums">
					{Math.round(current.temperature)}°
				</p>
				<p className="max-w-full truncate text-[11px] text-muted-foreground">
					{location.name} · {meta.label}
				</p>
				{today && (
					<p className="text-[10px] tabular-nums text-muted-foreground">
						{Math.round(today.temperatureMin)}° ~ {Math.round(today.temperatureMax)}°
					</p>
				)}
				<p className="max-w-full truncate text-[10px] text-muted-foreground">
					{windLabel(current.windSpeed, current.windDirection)}
				</p>
			</div>
		)
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col justify-center">
			<div className="flex items-center justify-between gap-4">
				<div className="flex min-w-0 items-center gap-3">
					<WeatherIcon code={current.code} isDay={current.isDay} className="h-10 w-10 shrink-0" />
					<div className="min-w-0">
						<p className="font-display text-4xl font-semibold leading-none tabular-nums">
							{Math.round(current.temperature)}°
						</p>
						<p className="mt-1.5 truncate text-xs text-muted-foreground">{meta.label}</p>
					</div>
				</div>
				<div className="shrink-0 text-right text-xs leading-5 text-muted-foreground">
					{today && (
						<p className="font-medium text-foreground tabular-nums">
							{Math.round(today.temperatureMin)}° ~ {Math.round(today.temperatureMax)}°
						</p>
					)}
					<p>湿度 {current.humidity}%</p>
					<p>{windLabel(current.windSpeed, current.windDirection)}</p>
				</div>
			</div>
			{size === '2x2' && (
				<ol className="mt-5 grid grid-cols-4 gap-2 border-t border-[color:var(--rv-navy)]/10 pt-3">
					{upcomingHours(forecast, 4).map((hour, index) => (
						<li key={hour.time} className="flex flex-col items-center gap-1 text-center">
							<span className="text-[10px] text-muted-foreground">
								{index === 0 ? '现在' : hour.time.slice(11, 16)}
							</span>
							<WeatherIcon
								code={hour.code}
								isDay={Number(hour.time.slice(11, 13)) >= 6 && Number(hour.time.slice(11, 13)) < 18}
								className="h-4 w-4"
							/>
							<span className="font-display text-sm font-semibold tabular-nums">
								{Math.round(hour.temperature)}°
							</span>
						</li>
					))}
				</ol>
			)}
		</div>
	)
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
	const { locations, ready } = useWeatherLocations()
	const [forecasts, setForecasts] = useState<Record<string, WeatherForecast | undefined>>({})
	const [errors, setErrors] = useState<Record<string, string | undefined>>({})
	const [reloadVersion, setReloadVersion] = useState(0)
	const [index, setIndex] = useState(0)
	const [dialogOpen, setDialogOpen] = useState(false)
	const [paused, setPaused] = useState(false)
	const [pageVisible, setPageVisible] = useState(true)
	const locationsKey = locations.map((location) => location.id).join(',')

	useEffect(() => {
		if (!ready) return
		let active = true
		const controller = new AbortController()
		for (const location of locations) {
			const key = String(location.id)
			setErrors((previous) => ({ ...previous, [key]: undefined }))
			void getWeatherForecast(location, controller.signal)
				.then((forecast) => {
					if (!active) return
					setForecasts((previous) => ({ ...previous, [key]: forecast }))
				})
				.catch((reason: unknown) => {
					if (!active || (reason as { name?: string })?.name === 'AbortError') return
					setErrors((previous) => ({ ...previous, [key]: '天气暂时不可用，请检查网络后重试' }))
				})
		}
		return () => {
			active = false
			controller.abort()
		}
	}, [locations, ready, reloadVersion])

	useEffect(() => {
		const timer = window.setInterval(() => setReloadVersion((version) => version + 1), REFRESH_MS)
		return () => window.clearInterval(timer)
	}, [])

	useEffect(() => {
		setIndex(0)
	}, [locationsKey])

	useEffect(() => {
		const update = () => setPageVisible(!document.hidden)
		update()
		document.addEventListener('visibilitychange', update)
		return () => document.removeEventListener('visibilitychange', update)
	}, [])

	useEffect(() => {
		if (
			locations.length <= 1 ||
			paused ||
			editing ||
			dialogOpen ||
			!pageVisible ||
			prefersReducedMotion()
		) {
			return
		}
		const timer = window.setInterval(
			() => setIndex((current) => (current + 1) % locations.length),
			ROTATE_MS,
		)
		return () => window.clearInterval(timer)
	}, [dialogOpen, editing, locations.length, pageVisible, paused])

	const location = locations[index % locations.length] ?? locations[0]
	const forecast = location ? forecasts[String(location.id)] : undefined
	const error = location ? errors[String(location.id)] : undefined
	const compact = size === '1x1'

	if (!location) return null

	return (
		<div
			className="h-full"
			onMouseEnter={() => setPaused(true)}
			onMouseLeave={() => setPaused(false)}
			onFocus={() => setPaused(true)}
			onBlur={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false)
			}}
		>
			<WidgetChrome
				title={compact ? undefined : location.name}
				caption={size === '2x2' ? 'Météo' : undefined}
				editing={editing}
				onRemove={onRemove}
				bodyClassName={cn('flex min-h-0 flex-col', compact && '!px-2.5 !pb-2 !pt-1')}
				tilt={-0.4}
			>
				{editing ? (
					<div className="flex min-h-0 flex-1 items-center justify-center">
						{forecast ? (
							<WeatherCardContent location={location} forecast={forecast} size={size} />
						) : (
							<p className="text-center text-xs text-muted-foreground">加载天气…</p>
						)}
					</div>
				) : (
					<Button
						type="button"
						variant="ghost"
						className="h-full min-h-0 w-full flex-1 flex-col whitespace-normal rounded-none px-0 py-0 font-normal hover:bg-transparent active:translate-y-0"
						onClick={() => setDialogOpen(true)}
						aria-label={`查看${location.name}天气详情`}
					>
						{forecast ? (
							<WeatherCardContent location={location} forecast={forecast} size={size} />
						) : error ? (
							<span className="flex flex-1 flex-col items-center justify-center gap-1 px-2 text-center">
								<span className="text-xs text-muted-foreground">天气暂时不可用</span>
								<span className="text-[10px] text-muted-foreground">点击查看并重试</span>
							</span>
						) : (
							<span className="flex flex-1 items-center justify-center gap-1.5 text-xs text-muted-foreground">
								<LoaderCircle className="h-3.5 w-3.5 animate-spin" /> 加载天气…
							</span>
						)}
					</Button>
				)}
				{!editing && locations.length > 1 && (
					<div
						className="flex h-3 shrink-0 items-center justify-center gap-1.5"
						aria-label="天气地区轮播"
					>
						{locations.map((item, itemIndex) => (
							<Button
								key={item.id}
								type="button"
								size="icon-sm"
								variant="ghost"
								className={cn(
									'h-2 min-h-0 w-2 rounded-full p-0',
									itemIndex === index % locations.length
										? 'bg-[color:var(--rv-rose-deep)]'
										: 'bg-[color:var(--rv-navy)]/20 hover:bg-[color:var(--rv-navy)]/40',
								)}
								aria-label={`切换到${item.name}`}
								aria-current={itemIndex === index % locations.length ? 'true' : undefined}
								onClick={() => setIndex(itemIndex)}
							/>
						))}
					</div>
				)}
			</WidgetChrome>
			<WeatherDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				initialLocationId={location.id}
				locations={locations}
				forecasts={forecasts}
				errors={errors}
				onRetry={() => setReloadVersion((version) => version + 1)}
			/>
		</div>
	)
}
