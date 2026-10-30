'use client'

import { Button } from '@/components/ui/button'
import { CHART } from '@/lib/chartPalette'
import { cn } from '@/lib/utils'
import type { Csi300EtfScalePoint } from '@briar/shared'
import type { MouseEventParams, Time } from 'lightweight-charts'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatAmount, formatPrice } from './marketUtils'

const RATIO_COLOR = CHART.warning
const INDEX_COLOR = CHART.plum
const TEXT = CHART.text
const GRID = CHART.grid

type ChartLib = typeof import('lightweight-charts')
let libPromise: Promise<ChartLib> | null = null
const loadLib = () => {
	libPromise ??= import('lightweight-charts').catch((error) => {
		libPromise = null
		throw error
	})
	return libPromise
}

type Csi300EtfChartPoint = Pick<
	Csi300EtfScalePoint,
	'date' | 'indexClose' | 'ratioPct' | 'totalAssets'
>

interface Csi300EtfScaleChartProps {
	data: Csi300EtfChartPoint[]
	ratioLabel: string
	amountLabel: string
	className?: string
}

export default function Csi300EtfScaleChart({
	data,
	ratioLabel,
	amountLabel,
	className,
}: Csi300EtfScaleChartProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const [lib, setLib] = useState<ChartLib | null>(null)
	const [libError, setLibError] = useState(false)
	const [attempt, setAttempt] = useState(0)
	const [hover, setHover] = useState<Csi300EtfChartPoint | null>(null)

	useEffect(() => {
		let cancelled = false
		loadLib()
			.then((module) => !cancelled && setLib(module))
			.catch(() => !cancelled && setLibError(true))
		return () => {
			cancelled = true
		}
	}, [attempt])

	useEffect(() => {
		const element = containerRef.current
		if (!lib || !element || data.length === 0) return
		const chart = lib.createChart(element, {
			autoSize: true,
			layout: {
				background: { type: lib.ColorType.Solid, color: 'transparent' },
				textColor: TEXT,
				fontFamily: CHART.fontFamily,
				fontSize: 11,
				attributionLogo: true,
			},
			grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
			leftPriceScale: {
				visible: true,
				borderVisible: false,
				scaleMargins: { top: 0.16, bottom: 0.14 },
			},
			rightPriceScale: {
				borderVisible: false,
				scaleMargins: { top: 0.16, bottom: 0.14 },
			},
			timeScale: {
				borderVisible: false,
				fixLeftEdge: true,
				fixRightEdge: true,
				lockVisibleTimeRangeOnResize: true,
				minBarSpacing: 0.5,
				rightOffset: 0,
			},
			crosshair: { mode: lib.CrosshairMode.Magnet },
			handleScroll: {
				mouseWheel: false,
				pressedMouseMove: true,
				horzTouchDrag: true,
				vertTouchDrag: false,
			},
			handleScale: {
				mouseWheel: false,
				pinch: true,
				axisPressedMouseMove: { time: true, price: false },
			},
			localization: { locale: 'zh-CN' },
		})
		const ratio = chart.addSeries(lib.LineSeries, {
			color: RATIO_COLOR,
			lineWidth: 2,
			priceScaleId: 'left',
			priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
			priceLineVisible: false,
			title: ratioLabel,
		})
		ratio.setData(data.map((point) => ({ time: point.date, value: point.ratioPct })))
		const index = chart.addSeries(lib.LineSeries, {
			color: INDEX_COLOR,
			lineWidth: 2,
			priceScaleId: 'right',
			priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
			priceLineVisible: false,
			title: '沪深300',
		})
		index.setData(data.map((point) => ({ time: point.date, value: point.indexClose })))
		chart.timeScale().fitContent()

		const onMove = (param: MouseEventParams<Time>) => {
			setHover(param.time == null || param.logical == null ? null : (data[param.logical] ?? null))
		}
		chart.subscribeCrosshairMove(onMove)
		return () => {
			chart.unsubscribeCrosshairMove(onMove)
			chart.remove()
			setHover(null)
		}
	}, [lib, data, ratioLabel])

	const point = hover ?? data.at(-1)
	return (
		<div className={cn('relative flex flex-col', className)}>
			<div className="flex min-h-[22px] flex-wrap items-center gap-x-3 gap-y-0.5 px-1 pb-1 text-[11px] leading-[18px] tabular-nums text-muted-foreground">
				{point && (
					<>
						<span>{point.date}</span>
						<span style={{ color: RATIO_COLOR }}>
							{ratioLabel} {point.ratioPct.toFixed(3)}%
						</span>
						<span style={{ color: INDEX_COLOR }}>沪深300 {formatPrice(point.indexClose)}</span>
						<span>
							{amountLabel} {formatAmount(point.totalAssets)}
						</span>
					</>
				)}
			</div>
			<div className="mb-1 flex justify-between px-1 text-[10px] text-muted-foreground">
				<span>左轴：{ratioLabel}（%）</span>
				<span>右轴：沪深300（点）</span>
			</div>
			<div
				ref={containerRef}
				className="min-h-0 w-full flex-1"
				role="img"
				aria-label={`头部四只沪深300ETF${ratioLabel}与沪深300收盘双轴走势图`}
			/>
			{!lib && (
				<div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
					{libError ? (
						<div className="flex flex-col items-center gap-2">
							<span>图表组件加载失败</span>
							<Button
								variant="default"
								size="sm"
								onClick={() => {
									setLibError(false)
									setAttempt((value) => value + 1)
								}}
							>
								重试图表
							</Button>
						</div>
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
