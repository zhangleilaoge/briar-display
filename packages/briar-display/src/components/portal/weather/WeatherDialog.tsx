'use client'

import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { PaperSheet } from '@/components/ui/paper-sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { ArrowLeft, Droplets, LoaderCircle, MapPin, Settings2, Wind } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { WeatherIcon } from './WeatherIcon'
import { WeatherLocationManager } from './WeatherLocationManager'
import {
	type WeatherForecast,
	type WeatherLocation,
	dailyDateLabel,
	upcomingHours,
	weatherLocationLabel,
	windLabel,
	wmoInfo,
} from './weather'

interface WeatherDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	initialLocationId: number
	locations: WeatherLocation[]
	forecasts: Record<string, WeatherForecast | undefined>
	errors: Record<string, string | undefined>
	onRetry: (locationId: number) => void
}

export function WeatherDialog({
	open,
	onOpenChange,
	initialLocationId,
	locations,
	forecasts,
	errors,
	onRetry,
}: WeatherDialogProps) {
	const [selectedId, setSelectedId] = useState(initialLocationId)
	const [view, setView] = useState<'forecast' | 'locations'>('forecast')
	const [hasMoreBelow, setHasMoreBelow] = useState(false)
	const bodyRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (open) {
			setSelectedId(initialLocationId)
			setView('forecast')
		}
	}, [initialLocationId, open])

	const updateScrollFade = useCallback(() => {
		const body = bodyRef.current
		if (!body) return
		setHasMoreBelow(body.scrollHeight - body.clientHeight - body.scrollTop > 1)
	}, [])

	useEffect(() => {
		const body = bodyRef.current
		if (!open || !body) return
		const resizeObserver = new ResizeObserver(updateScrollFade)
		const observeChildren = () => {
			for (const child of body.children) resizeObserver.observe(child)
		}
		resizeObserver.observe(body)
		observeChildren()
		const mutationObserver = new MutationObserver(() => {
			observeChildren()
			updateScrollFade()
		})
		mutationObserver.observe(body, { childList: true, subtree: true })
		updateScrollFade()
		return () => {
			resizeObserver.disconnect()
			mutationObserver.disconnect()
		}
	}, [forecasts, open, selectedId, updateScrollFade, view])

	const location = locations.find((item) => item.id === selectedId) ?? locations[0]
	if (!location) return null
	const forecast = forecasts[String(location.id)]
	const error = errors[String(location.id)]
	const today = forecast?.daily[0]
	const currentMeta = forecast ? wmoInfo(forecast.current.code, forecast.current.isDay) : null

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				onOpenChange(next)
				if (!next) setView('forecast')
			}}
		>
			<DialogContent data-no-drag className="max-w-2xl gap-4 overflow-y-auto p-5 sm:p-7">
				<DialogHeader
					className="rv-wx-header pr-9 text-left"
					kicker={`Météo · ${forecast?.current.time.slice(0, 10) ?? 'Carnet quotidien'}`}
				>
					<DialogTitle className="flex items-center gap-2">
						<MapPin aria-hidden className="rv-wx-pin h-4 w-4" />
						{view === 'forecast' ? `${location.name}天气` : '管理默认地区'}
					</DialogTitle>
					<DialogDescription>
						{view === 'forecast'
							? `${weatherLocationLabel(location)} · ${forecast?.timezone ?? location.timezone}`
							: '搜索并保存常看地区，多选后会在外部卡片轮播'}
					</DialogDescription>
				</DialogHeader>

				<div className="rv-wx-scroll" data-has-more={hasMoreBelow || undefined}>
					<div ref={bodyRef} className="rv-wx-body" onScroll={updateScrollFade}>
						{view === 'locations' ? (
							<div className="rv-wx-location-view">
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="mb-4 px-2"
									onClick={() => setView('forecast')}
								>
									<ArrowLeft className="h-4 w-4" /> 返回天气
								</Button>
								<WeatherLocationManager />
							</div>
						) : (
							<>
								<div className="rv-wx-location-bar flex items-center justify-between gap-2">
									{locations.length > 1 ? (
										<div
											className="rv-wx-location-switch flex min-w-0 flex-1 gap-1 overflow-x-auto pb-1"
											aria-label="切换天气地区"
										>
											{locations.map((item) => (
												<Button
													key={item.id}
													type="button"
													variant={item.id === location.id ? 'default' : 'ghost'}
													size="sm"
													className="h-7 shrink-0 px-2.5 text-xs"
													aria-pressed={item.id === location.id}
													onClick={() => setSelectedId(item.id)}
												>
													{item.name}
												</Button>
											))}
										</div>
									) : (
										<span />
									)}
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="rv-wx-manage h-8 shrink-0 px-2 text-xs"
										onClick={() => setView('locations')}
									>
										<Settings2 className="h-3.5 w-3.5" /> 管理地区
									</Button>
								</div>

								{!forecast && !error && (
									<div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
										<LoaderCircle className="h-4 w-4 animate-spin" /> 正在读取{location.name}天气…
									</div>
								)}
								{!forecast && error && (
									<div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
										<p className="text-sm text-muted-foreground">{error}</p>
										<Button
											type="button"
											variant="default"
											size="sm"
											onClick={() => onRetry(location.id)}
										>
											重新加载
										</Button>
									</div>
								)}
								{forecast && currentMeta && today && (
									<>
										<section className="rv-wx-now" aria-label={`${location.name}当前天气`}>
											<span className="rv-wx-tape" aria-hidden />
											<div className="rv-wx-reading">
												<WeatherIcon
													code={forecast.current.code}
													isDay={forecast.current.isDay}
													className="rv-wx-now-icon h-14 w-14"
												/>
												<div>
													<p className="rv-wx-temperature font-display font-semibold tabular-nums">
														{Math.round(forecast.current.temperature)}°
													</p>
													<p className="rv-wx-condition">{currentMeta.label}</p>
												</div>
											</div>
											<dl className="rv-wx-metrics">
												<div>
													<dt>今日气温</dt>
													<dd>
														{Math.round(today.temperatureMin)}° ~ {Math.round(today.temperatureMax)}
														°
													</dd>
												</div>
												<div>
													<dt>体感温度</dt>
													<dd>{Math.round(forecast.current.apparentTemperature)}°</dd>
												</div>
												<div>
													<dt>
														<Droplets aria-hidden className="h-3.5 w-3.5" /> 相对湿度
													</dt>
													<dd>{forecast.current.humidity}%</dd>
												</div>
												<div>
													<dt>
														<Wind aria-hidden className="h-3.5 w-3.5" /> 风向风速
													</dt>
													<dd>
														{windLabel(forecast.current.windSpeed, forecast.current.windDirection)}
													</dd>
												</div>
											</dl>
										</section>

										<Tabs key={location.id} defaultValue="hourly" className="rv-wx-forecast-tabs">
											<TabsList className="rv-wx-tabs">
												<TabsTrigger value="hourly">逐小时</TabsTrigger>
												<TabsTrigger value="daily">未来 7 天</TabsTrigger>
											</TabsList>
											<PaperSheet
												variant="torn"
												className="rv-wx-forecast-paper"
												bodyClassName="!px-4 !pb-5 !pt-6 sm:!px-6 sm:!pb-6 sm:!pt-7"
											>
												<TabsContent value="hourly" className="mt-3">
													<ol className="rv-wx-hours" aria-label="未来 24 小时天气">
														{upcomingHours(forecast).map((hour, index) => {
															const hourNumber = Number(hour.time.slice(11, 13))
															const crossesDay =
																hour.time.slice(0, 10) !== forecast.current.time.slice(0, 10)
															return (
																<li key={hour.time} className="rv-wx-hour">
																	<span className={cn('text-xs', index === 0 && 'rv-wx-hour-now')}>
																		{index === 0 ? '现在' : hour.time.slice(11, 16)}
																	</span>
																	<WeatherIcon
																		code={hour.code}
																		isDay={hourNumber >= 6 && hourNumber < 18}
																		className="h-5 w-5"
																	/>
																	<span className="font-display text-lg font-semibold tabular-nums">
																		{Math.round(hour.temperature)}°
																	</span>
																	<span className="text-[10px] text-muted-foreground">
																		降水 {hour.precipitationProbability}%
																	</span>
																	{crossesDay && hour.time.endsWith('00:00') && (
																		<span className="text-[9px] text-muted-foreground">
																			{hour.time.slice(5, 10).replace('-', '/')}
																		</span>
																	)}
																</li>
															)
														})}
													</ol>
												</TabsContent>
												<TabsContent value="daily" className="mt-3">
													<ol className="rv-wx-days" aria-label="未来 7 天天气">
														{forecast.daily.map((day, index) => (
															<li key={day.date} className="rv-wx-day">
																<div className="rv-wx-day-date">
																	<p className="font-medium">{dailyDateLabel(day.date, index)}</p>
																	<p className="text-[10px] text-muted-foreground">
																		{day.date.slice(5).replace('-', '/')}
																	</p>
																</div>
																<WeatherIcon code={day.code} className="h-5 w-5" />
																<div>
																	<p>{wmoInfo(day.code).label}</p>
																	<p className="mt-0.5 text-[10px] text-muted-foreground">
																		降水 {day.precipitationProbability}%
																	</p>
																</div>
																<p className="rv-wx-day-temperature whitespace-nowrap font-display text-base font-semibold tabular-nums">
																	{Math.round(day.temperatureMin)}° /{' '}
																	{Math.round(day.temperatureMax)}°
																</p>
																<p className="hidden whitespace-nowrap text-[10px] text-muted-foreground sm:block">
																	{windLabel(day.windSpeed, day.windDirection)}
																</p>
															</li>
														))}
													</ol>
												</TabsContent>
											</PaperSheet>
										</Tabs>
										<p className="rv-wx-updated text-right text-[10px] text-muted-foreground">
											更新于{' '}
											{new Date(forecast.fetchedAt).toLocaleTimeString('zh-CN', {
												hour: '2-digit',
												minute: '2-digit',
											})}
											{error ? ' · 刷新失败，当前为上次数据' : ''}
										</p>
									</>
								)}
							</>
						)}
					</div>
					<span className="rv-wx-scroll-fade" aria-hidden />
				</div>
			</DialogContent>
		</Dialog>
	)
}
