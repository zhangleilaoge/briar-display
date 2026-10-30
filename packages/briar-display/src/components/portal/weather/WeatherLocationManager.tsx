'use client'

import { Button } from '@/components/ui/button'
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from '@/components/ui/command'
import { Check, LoaderCircle, MapPin, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { weatherLocationLabel } from './weather'
import { searchWeatherLocations } from './weatherApi'
import { useWeatherLocations } from './weatherLocationStore'

export function WeatherLocationManager() {
	const { locations, mode, saving, add, remove } = useWeatherLocations()
	const [query, setQuery] = useState('')
	const [results, setResults] = useState<typeof locations>([])
	const [searching, setSearching] = useState(false)
	const [error, setError] = useState('')

	useEffect(() => {
		const controller = new AbortController()
		const name = query.trim()
		setError('')
		if (name.length < 2) {
			setResults([])
			setSearching(false)
			return () => controller.abort()
		}
		setSearching(true)
		const timer = window.setTimeout(() => {
			void searchWeatherLocations(name, controller.signal)
				.then(setResults)
				.catch((reason: unknown) => {
					if ((reason as { name?: string })?.name === 'AbortError') return
					setResults([])
					setError('城市搜索暂时不可用，请稍后重试')
				})
				.finally(() => {
					if (!controller.signal.aborted) setSearching(false)
				})
		}, 280)
		return () => {
			window.clearTimeout(timer)
			controller.abort()
		}
	}, [query])

	return (
		<div className="space-y-4">
			<section aria-label="已保存的默认地区">
				<div className="mb-2 flex items-center justify-between gap-3">
					<p className="text-xs text-muted-foreground">
						{mode === 'server' ? '已绑定账号，跨设备同步' : '当前保存在本机'}
						{locations.length > 1 ? ' · 卡片将自动轮播' : ''}
					</p>
					{saving && <LoaderCircle aria-label="保存中" className="h-3.5 w-3.5 animate-spin" />}
				</div>
				<ul className="flex flex-wrap gap-2">
					{locations.map((location) => (
						<li
							key={location.id}
							className="rv-wx-loc-chip flex max-w-full items-center gap-1 rounded-full border border-[color:var(--rv-navy)]/15 bg-[var(--rv-cream)] py-1 pl-2.5 pr-1"
						>
							<MapPin aria-hidden className="h-3 w-3 shrink-0 text-[color:var(--rv-rose-deep)]" />
							<span className="truncate text-xs" title={weatherLocationLabel(location)}>
								{location.name}
							</span>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								className="h-6 w-6 rounded-full"
								disabled={saving || locations.length === 1}
								onClick={() => void remove(location.id)}
								aria-label={`移除${location.name}`}
							>
								<X className="h-3 w-3" />
							</Button>
						</li>
					))}
				</ul>
			</section>

			<Command
				shouldFilter={false}
				className="rv-wx-search border border-[color:var(--rv-navy)]/15"
			>
				<CommandInput
					value={query}
					onValueChange={setQuery}
					placeholder="搜索城市，例如：北京、Paris"
					aria-label="搜索天气地区"
				/>
				<CommandList>
					{query.trim().length < 2 && (
						<p className="px-3 py-5 text-center text-xs text-muted-foreground">
							输入至少两个字，选择后加入默认地区
						</p>
					)}
					{searching && (
						<p className="flex items-center justify-center gap-2 py-5 text-xs text-muted-foreground">
							<LoaderCircle className="h-3.5 w-3.5 animate-spin" /> 正在搜索…
						</p>
					)}
					{error && <p className="py-5 text-center text-xs text-destructive">{error}</p>}
					{!searching && !error && query.trim().length >= 2 && results.length === 0 && (
						<CommandEmpty>没有找到匹配地区</CommandEmpty>
					)}
					{!searching &&
						results.map((location) => {
							const exists = locations.some((item) => item.id === location.id)
							return (
								<CommandItem
									key={location.id}
									value={`${location.name}-${location.id}`}
									disabled={exists || saving}
									onPointerDown={(event) => {
										if (exists || saving) return
										event.preventDefault()
										void add(location)
									}}
									onSelect={() => void add(location)}
								>
									<MapPin className="text-[color:var(--rv-rose-deep)]" />
									<span className="min-w-0 flex-1">
										<span className="block truncate font-medium">{location.name}</span>
										<span className="block truncate text-xs text-muted-foreground">
											{weatherLocationLabel(location)}
										</span>
									</span>
									{exists ? <Check aria-label="已添加" /> : <Plus aria-label="添加地区" />}
								</CommandItem>
							)
						})}
				</CommandList>
			</Command>
			<p className="text-[11px] leading-relaxed text-muted-foreground">
				最多保存 6 个地区；至少保留一个。天气与时间按各地区自身时区展示。
			</p>
		</div>
	)
}
