'use client'

import { cn } from '@/lib/utils'
import type { Candle, MinuteDay } from '@briar/shared'
import type {
	AutoscaleInfo,
	ISeriesApi,
	LogicalRange,
	MouseEventParams,
	SeriesType,
	TickMarkType,
	Time,
	UTCTimestamp,
	WhitespaceData,
} from 'lightweight-charts'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
	type MinuteRow,
	buildMinuteRows,
	formatVolume,
	movingAverage,
	shiftedLabel,
} from './chartData'
import { formatPct, formatPrice } from './marketUtils'

/** lightweight-charts（TradingView 开源版）按需加载：只有打开走势面板才下载 */
type ChartLib = typeof import('lightweight-charts')
let libPromise: Promise<ChartLib> | null = null
const loadLib = () => {
	libPromise ??= import('lightweight-charts').catch((err) => {
		libPromise = null
		throw err
	})
	return libPromise
}

const UP = '#dc2626'
const DOWN = '#16a34a'
const UP_VOL = 'rgba(220, 38, 38, 0.55)'
const DOWN_VOL = 'rgba(22, 163, 74, 0.55)'
const TEXT = '#64748b'
const GRID = 'rgba(148, 163, 184, 0.18)'
const BASE = '#94a3b8'
const MA_COLORS = { 5: '#f59e0b', 10: '#3b82f6', 20: '#a855f7' } as const
const MA_PERIODS = [5, 10, 20] as const

export type TrendChartData =
	| { kind: 'minute'; days: MinuteDay[]; prevClose: number | null; multiDay: boolean }
	| { kind: 'candle'; candles: Candle[]; period: 'day' | 'week' | 'month' }

interface TrendChartProps {
	data: TrendChartData
	timeZone: string
	/** 切换标的 / 周期时变化：用来决定是否重置可视范围 */
	resetKey: string
	className?: string
}

const pctOf = (price: number, base: number | null | undefined) =>
	base ? ((price - base) / base) * 100 : null

/** 坐标轴时间：分钟线是平移后的秒，K 线是 BusinessDay / 'YYYY-MM-DD' */
type TimeParts = { sec: number } | { y: number; m: number; d: number }

function timeParts(time: Time): TimeParts {
	if (typeof time === 'number') return { sec: time }
	if (typeof time === 'string') {
		const [y, m, d] = time.split('-').map(Number)
		return { y, m, d }
	}
	return { y: time.year, m: time.month, d: time.day }
}

const pad = (n: number) => String(n).padStart(2, '0')

function candleLabel(time: Time, short = false) {
	const p = timeParts(time)
	if ('sec' in p) return shiftedLabel(p.sec, 'date')
	return short ? `${p.y}-${pad(p.m)}` : `${p.y}-${pad(p.m)}-${pad(p.d)}`
}

type Legend =
	| { kind: 'minute'; row: MinuteRow; base: number | null }
	| { kind: 'candle'; candle: Candle; prevClose: number | null; ma: (number | null)[] }

/** 走势图：分时/五日 = 基准线面积图 + 成交量；日/周/月K = 蜡烛 + 成交量 + MA5/10/20；红涨绿跌 */
export default function TrendChart({ data, timeZone, resetKey, className }: TrendChartProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	/** 轮询刷新会重建图：同一标的同一周期保留用户拖动/缩放后的 K 线范围 */
	const rangeRef = useRef<{ key: string; range: LogicalRange | null }>({ key: '', range: null })
	const [lib, setLib] = useState<ChartLib | null>(null)
	const [libError, setLibError] = useState(false)
	const [hover, setHover] = useState<Legend | null>(null)

	useEffect(() => {
		let cancelled = false
		loadLib()
			.then((m) => !cancelled && setLib(m))
			.catch(() => !cancelled && setLibError(true))
		return () => {
			cancelled = true
		}
	}, [])

	const minuteRows = useMemo(
		() => (data.kind === 'minute' ? buildMinuteRows(data.days, timeZone) : []),
		[data, timeZone],
	)
	const maLines = useMemo(
		() => (data.kind === 'candle' ? MA_PERIODS.map((n) => movingAverage(data.candles, n)) : []),
		[data],
	)
	const minuteBase =
		data.kind === 'minute'
			? (data.prevClose ?? minuteRows.find((r) => r.price != null)?.price ?? null)
			: null

	/** 默认图例：最后一根（手机上不用长按也能看到最新值） */
	const defaultLegend = useMemo<Legend | null>(() => {
		if (data.kind === 'minute') {
			const row = [...minuteRows].reverse().find((r) => r.price != null)
			return row ? { kind: 'minute', row, base: minuteBase } : null
		}
		const i = data.candles.length - 1
		if (i < 0) return null
		return {
			kind: 'candle',
			candle: data.candles[i],
			prevClose: data.candles[i - 1]?.[4] ?? null,
			ma: maLines.map((l) => l[i]),
		}
	}, [data, minuteRows, minuteBase, maLines])

	// 数据 / 模式变化就重建图（数据量 ≤ 2000 根，重建很便宜，也避免序列类型切换的状态问题）
	useEffect(() => {
		const el = containerRef.current
		if (!lib || !el) return
		const isMinute = data.kind === 'minute'
		const chart = lib.createChart(el, {
			autoSize: true,
			layout: {
				background: { type: lib.ColorType.Solid, color: 'transparent' },
				textColor: TEXT,
				fontSize: 11,
				attributionLogo: true,
			},
			grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
			rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.26 } },
			timeScale: {
				borderVisible: false,
				fixLeftEdge: true,
				fixRightEdge: true,
				lockVisibleTimeRangeOnResize: true,
				minBarSpacing: isMinute ? 0.05 : 0.5,
				rightOffset: 0,
				tickMarkFormatter: (time: Time, type: TickMarkType) => {
					if (!isMinute) return candleLabel(time, type <= 1)
					const p = timeParts(time)
					if (!('sec' in p)) return null
					// 五日：日期级刻度显示 MM-DD，其余显示 HH:MM
					return data.kind === 'minute' && data.multiDay && type <= 2
						? shiftedLabel(p.sec, 'date')
						: shiftedLabel(p.sec, 'time')
				},
			},
			localization: {
				locale: 'zh-CN',
				timeFormatter: (time: Time) => {
					const p = timeParts(time)
					return 'sec' in p ? shiftedLabel(p.sec, 'datetime') : candleLabel(time)
				},
				priceFormatter: (price: number) => formatPrice(price),
			},
			crosshair: { mode: lib.CrosshairMode.Magnet },
			handleScroll: isMinute
				? false
				: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
			handleScale: isMinute
				? false
				: { mouseWheel: true, pinch: true, axisPressedMouseMove: { time: true, price: false } },
		})

		const volume = chart.addSeries(lib.HistogramSeries, {
			priceScaleId: 'vol',
			priceFormat: { type: 'volume' },
			lastValueVisible: false,
			priceLineVisible: false,
		})
		chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })

		let main: ISeriesApi<SeriesType>
		if (data.kind === 'minute') {
			const base = minuteBase ?? 0
			main = chart.addSeries(lib.BaselineSeries, {
				baseValue: { type: 'price', price: base },
				topLineColor: UP,
				topFillColor1: 'rgba(220, 38, 38, 0.18)',
				topFillColor2: 'rgba(220, 38, 38, 0.02)',
				bottomLineColor: DOWN,
				bottomFillColor1: 'rgba(22, 163, 74, 0.02)',
				bottomFillColor2: 'rgba(22, 163, 74, 0.18)',
				lineWidth: 2,
				priceLineVisible: false,
				// 纵轴以昨收为中心对称（同花顺分时的做法），涨跌幅一眼可比
				autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
					const res = original()
					if (!res?.priceRange || !base) return res
					const d = Math.max(
						Math.abs(res.priceRange.maxValue - base),
						Math.abs(res.priceRange.minValue - base),
						base * 0.002,
					)
					return { ...res, priceRange: { minValue: base - d, maxValue: base + d } }
				},
			})
			if (minuteBase != null) {
				main.createPriceLine({
					price: minuteBase,
					color: BASE,
					lineWidth: 1,
					lineStyle: lib.LineStyle.Dashed,
					axisLabelVisible: true,
					title: data.multiDay ? '基准' : '昨收',
				})
			}
			main.setData(
				minuteRows.map((r) =>
					r.price == null
						? ({ time: r.time as UTCTimestamp } as WhitespaceData)
						: { time: r.time as UTCTimestamp, value: r.price },
				),
			)
			volume.setData(
				minuteRows.map((r) =>
					r.vol == null
						? ({ time: r.time as UTCTimestamp } as WhitespaceData)
						: { time: r.time as UTCTimestamp, value: r.vol, color: r.up ? UP_VOL : DOWN_VOL },
				),
			)
			chart.timeScale().fitContent()
		} else {
			main = chart.addSeries(lib.CandlestickSeries, {
				upColor: UP,
				downColor: DOWN,
				borderUpColor: UP,
				borderDownColor: DOWN,
				wickUpColor: UP,
				wickDownColor: DOWN,
				priceLineVisible: false,
			})
			main.setData(
				data.candles.map(([time, open, high, low, close]) => ({ time, open, high, low, close })),
			)
			volume.setData(
				data.candles.map(([time, open, , , close, vol]) =>
					vol == null
						? ({ time } as WhitespaceData)
						: { time, value: vol, color: close >= open ? UP_VOL : DOWN_VOL },
				),
			)
			MA_PERIODS.forEach((n, k) => {
				const line = chart.addSeries(lib.LineSeries, {
					color: MA_COLORS[n],
					lineWidth: 1,
					priceLineVisible: false,
					lastValueVisible: false,
					crosshairMarkerVisible: false,
				})
				line.setData(
					data.candles.map(([time], i) => {
						const v = maLines[k][i]
						return v == null ? ({ time } as WhitespaceData) : { time, value: v }
					}),
				)
			})
			// 默认显示最近一段（手机约 60 根），可拖动 / 双指缩放看更早
			const n = data.candles.length
			const visible = el.clientWidth < 480 ? 60 : 100
			const kept = rangeRef.current.key === resetKey ? rangeRef.current.range : null
			chart
				.timeScale()
				.setVisibleLogicalRange(kept ?? { from: Math.max(0, n - visible), to: n + 1 })
		}

		const onMove = (param: MouseEventParams<Time>) => {
			const i = param.logical
			if (i == null || param.time == null) {
				setHover(null)
				return
			}
			if (data.kind === 'minute') {
				const row = minuteRows[i]
				setHover(row?.price != null ? { kind: 'minute', row, base: minuteBase } : null)
			} else {
				const candle = data.candles[i]
				setHover(
					candle
						? {
								kind: 'candle',
								candle,
								prevClose: data.candles[i - 1]?.[4] ?? null,
								ma: maLines.map((l) => l[i]),
							}
						: null,
				)
			}
		}
		chart.subscribeCrosshairMove(onMove)
		return () => {
			chart.unsubscribeCrosshairMove(onMove)
			if (!isMinute) {
				rangeRef.current = { key: resetKey, range: chart.timeScale().getVisibleLogicalRange() }
			}
			chart.remove()
			setHover(null)
		}
	}, [lib, data, minuteRows, maLines, minuteBase, resetKey])

	const legend = hover ?? defaultLegend

	return (
		<div className={cn('relative flex flex-col', className)}>
			<div className="flex min-h-[18px] flex-wrap gap-x-3 px-1 pb-1 text-[11px] leading-[18px] tabular-nums text-muted-foreground">
				{legend?.kind === 'minute' && (
					<MinuteLegend legend={legend} multiDay={data.kind === 'minute' && data.multiDay} />
				)}
				{legend?.kind === 'candle' && <CandleLegend legend={legend} />}
			</div>
			<div ref={containerRef} className="min-h-0 w-full flex-1" />
			{!lib && (
				<div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
					{libError ? (
						'图表组件加载失败，请刷新重试'
					) : (
						<>
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							加载图表…
						</>
					)}
				</div>
			)}
		</div>
	)
}

const colorOf = (pct: number | null) => (pct == null || pct === 0 ? undefined : pct > 0 ? UP : DOWN)

function MinuteLegend({
	legend,
	multiDay,
}: { legend: Extract<Legend, { kind: 'minute' }>; multiDay: boolean }) {
	const { row } = legend
	const price = row.price as number
	// 涨跌幅相对当天昨收（五日里每天各算各的，和同花顺一致）
	const pct = pctOf(price, row.prevClose ?? legend.base)
	return (
		<>
			<span>{shiftedLabel(row.time, multiDay ? 'datetime' : 'time')}</span>
			<span style={{ color: colorOf(pct) }}>
				{formatPrice(price)} {formatPct(pct)}
			</span>
			{row.vol != null && <span>量 {formatVolume(row.vol)}</span>}
		</>
	)
}

function CandleLegend({ legend }: { legend: Extract<Legend, { kind: 'candle' }> }) {
	const [date, open, high, low, close, vol] = legend.candle
	const pct = pctOf(close, legend.prevClose)
	return (
		<>
			<span>{date}</span>
			<span>
				开 {formatPrice(open)} 高 {formatPrice(high)} 低 {formatPrice(low)}{' '}
				<span style={{ color: colorOf(pct) }}>
					收 {formatPrice(close)} {formatPct(pct)}
				</span>
			</span>
			{vol != null && <span>量 {formatVolume(vol)}</span>}
			{MA_PERIODS.map((n, k) => (
				<span key={n} style={{ color: MA_COLORS[n] }}>
					MA{n}{' '}
					{legend.ma[k] == null ? '--' : formatPrice(Number((legend.ma[k] as number).toFixed(3)))}
				</span>
			))}
		</>
	)
}
