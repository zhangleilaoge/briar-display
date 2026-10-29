'use client'

import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { ArrowLeft, Droplets, LoaderCircle, MapPin, Settings2, Wind } from 'lucide-react'
import { useEffect, useState } from 'react'
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
	useEffect(() => {
		if (open) {
			setSelectedId(initialLocationId)
			setView('forecast')
		}
	}, [initialLocationId, open])

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
			<DialogContent className="max-w-2xl gap-3 overflow-y-auto p-4 sm:p-6">
				<DialogHeader className="pr-7 text-left">
					<DialogTitle className="flex items-center gap-2">
						<MapPin aria-hidden className="h-4 w-4 text-[color:var(--rv-rose-deep)]" />
						{view === 'forecast' ? `${location.name}天气` : '管理默认地区'}
					</DialogTitle>
					<DialogDescription>
						{view === 'forecast'
							? `${weatherLocationLabel(location)} · ${forecast?.timezone ?? location.timezone}`
							: '搜索并保存常看地区，多选后会在外部卡片轮播'}
					</DialogDescription>
				</DialogHeader>

				{view === 'locations' ? (
					<>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="self-start px-2"
							onClick={() => setView('forecast')}
						>
							<ArrowLeft className="h-4 w-4" /> 返回天气
						</Button>
						<WeatherLocationManager />
					</>
				) : (
					<>
						<div className="flex items-center justify-between gap-2">
							{locations.length > 1 ? (
								<div
									className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-1"
									aria-label="切换天气地区"
								>
									{locations.map((item) => (
										<Button
											key={item.id}
											type="button"
											variant={item.id === location.id ? 'secondary' : 'ghost'}
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
								className="h-8 shrink-0 px-2 text-xs"
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
									variant="outline"
									size="sm"
									onClick={() => onRetry(location.id)}
								>
									重新加载
								</Button>
							</div>
						)}
						{forecast && currentMeta && today && (
							<>
								<section className="rounded-2xl border border-[color:color-mix(in_srgb,var(--rv-rose-deep)_20%,transparent)] bg-[color-mix(in_srgb,var(--rv-cream)_72%,var(--rv-pink))] p-4">
									<div className="flex items-center justify-between gap-4">
										<div className="flex items-center gap-3">
											<WeatherIcon
												code={forecast.current.code}
												isDay={forecast.current.isDay}
												className="h-12 w-12 text-[color:color-mix(in_srgb,var(--rv-ink)_70%,var(--rv-rose-deep))]"
											/>
											<div>
												<p className="font-display text-5xl font-semibold leading-none tabular-nums">
													{Math.round(forecast.current.temperature)}°
												</p>
												<p className="mt-2 text-sm text-muted-foreground">{currentMeta.label}</p>
											</div>
										</div>
										<div className="text-right text-xs leading-6 text-muted-foreground">
											<p className="font-medium text-foreground">
												{Math.round(today.temperatureMin)}° ~ {Math.round(today.temperatureMax)}°
											</p>
											<p>体感 {Math.round(forecast.current.apparentTemperature)}°</p>
											<p className="flex items-center justify-end gap-1.5">
												<Droplets className="h-3.5 w-3.5" /> 湿度 {forecast.current.humidity}%
											</p>
											<p className="flex items-center justify-end gap-1.5">
												<Wind className="h-3.5 w-3.5" />
												{windLabel(forecast.current.windSpeed, forecast.current.windDirection)}
											</p>
										</div>
									</div>
								</section>

								<Tabs key={location.id} defaultValue="hourly">
									<TabsList className="grid w-full grid-cols-2">
										<TabsTrigger value="hourly">逐小时</TabsTrigger>
										<TabsTrigger value="daily">未来 7 天</TabsTrigger>
									</TabsList>
									<TabsContent value="hourly" className="mt-3">
										<ol className="flex gap-2 overflow-x-auto pb-2" aria-label="未来 24 小时天气">
											{upcomingHours(forecast).map((hour, index) => {
												const hourNumber = Number(hour.time.slice(11, 13))
												const crossesDay =
													hour.time.slice(0, 10) !== forecast.current.time.slice(0, 10)
												return (
													<li
														key={hour.time}
														className="flex min-w-[4.5rem] flex-col items-center gap-2 rounded-xl border border-[color:color-mix(in_srgb,var(--rv-rose-deep)_16%,transparent)] bg-[color-mix(in_srgb,var(--rv-cream)_80%,white)] px-2 py-3 text-center"
													>
														<span
															className={cn(
																'text-xs',
																index === 0 && 'font-semibold text-[color:var(--rv-rose-deep)]',
															)}
														>
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
										<ol
											className="divide-y divide-[color:color-mix(in_srgb,var(--rv-rose-deep)_14%,transparent)]"
											aria-label="未来 7 天天气"
										>
											{forecast.daily.map((day, index) => (
												<li
													key={day.date}
													className="grid grid-cols-[3.5rem_1.5rem_1fr_auto] items-center gap-2 py-2.5 text-xs sm:grid-cols-[4rem_1.5rem_1fr_auto_auto] sm:gap-3"
												>
													<div>
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
													<p className="whitespace-nowrap font-display text-base font-semibold tabular-nums">
														{Math.round(day.temperatureMin)}° / {Math.round(day.temperatureMax)}°
													</p>
													<p className="hidden whitespace-nowrap text-[10px] text-muted-foreground sm:block">
														{windLabel(day.windSpeed, day.windDirection)}
													</p>
												</li>
											))}
										</ol>
									</TabsContent>
								</Tabs>
								<p className="text-right text-[10px] text-muted-foreground">
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
			</DialogContent>
		</Dialog>
	)
}
