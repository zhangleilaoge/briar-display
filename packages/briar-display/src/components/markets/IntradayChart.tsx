import { cn } from '@/lib/utils'
import type { MarketId, TrendSeries } from '@briar/shared'
import { type PointerEvent, useId, useMemo, useRef, useState } from 'react'
import { TZ_LABELS, formatPct, formatPrice, formatZonedHm } from './marketUtils'
import {
	buildPaths,
	makeTimeScale,
	nearestIndex,
	priceDomain,
	sessionBreaks,
} from './trendGeometry'

interface IntradayChartProps {
	series: TrendSeries
	market: MarketId
	timeZone: string
	height?: number
	/** 横轴时间 + 纵轴价格/涨跌幅标签 */
	showAxis?: boolean
	/** 悬停 / 触摸查看某一分钟 */
	interactive?: boolean
	emptyText?: string
	className?: string
}

const VB_W = 1000
const UP = '#dc2626'
const DOWN = '#16a34a'
const FLAT = '#64748b'

const pctOf = (price: number, base: number | null) => (base ? ((price - base) / base) * 100 : null)

/** 当日分时图（纯 SVG）：横轴为当地交易时段（午休压缩），虚线为昨收基准，红涨绿跌 */
export default function IntradayChart({
	series,
	market,
	timeZone,
	height = 200,
	showAxis = true,
	interactive = true,
	emptyText = '暂无分时数据',
	className,
}: IntradayChartProps) {
	const gradientId = useId()
	const boxRef = useRef<HTMLDivElement>(null)
	const [hover, setHover] = useState<number | null>(null)
	const { points, prevClose, sessions } = series

	const geo = useMemo(() => {
		const xOf = makeTimeScale(sessions, points)
		const domain = priceDomain(points, prevClose)
		const paths = buildPaths(points, xOf, domain, VB_W, height)
		const [lo, hi] = domain
		const baseY = prevClose != null ? (1 - (prevClose - lo) / (hi - lo || 1)) * height : null
		return {
			...paths,
			fracs: points.map(([ts]) => xOf(ts)),
			domain,
			baseY,
			breaks: sessionBreaks(sessions),
		}
	}, [points, prevClose, sessions, height])

	if (points.length === 0) {
		return (
			<div
				className={cn('flex items-center justify-center text-xs text-muted-foreground', className)}
				style={{ height }}
			>
				{emptyText}
			</div>
		)
	}

	const last = points[points.length - 1][1]
	const base = prevClose ?? points[0][1]
	const color = last > base ? UP : last < base ? DOWN : FLAT

	const onMove = (e: PointerEvent<HTMLDivElement>) => {
		const rect = boxRef.current?.getBoundingClientRect()
		if (!rect || rect.width === 0) return
		const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
		setHover(nearestIndex(geo.fracs, frac))
	}

	const hoverPoint = hover != null && hover >= 0 ? points[hover] : null
	const hoverCoord = hover != null && hover >= 0 ? geo.coords[hover] : null
	const hoverPct = hoverPoint ? pctOf(hoverPoint[1], prevClose) : null
	const tzLabel = TZ_LABELS[market]
	const [lo, hi] = geo.domain

	return (
		<div className={className}>
			<div
				ref={boxRef}
				className={cn('relative select-none', interactive && 'cursor-crosshair touch-pan-y')}
				style={{ height }}
				onPointerMove={interactive ? onMove : undefined}
				onPointerDown={interactive ? onMove : undefined}
				onPointerLeave={interactive ? () => setHover(null) : undefined}
			>
				<svg
					viewBox={`0 0 ${VB_W} ${height}`}
					preserveAspectRatio="none"
					className="absolute inset-0 h-full w-full overflow-visible"
					role="img"
					aria-label={`${series.name} 当日分时`}
				>
					<defs>
						<linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
							<stop offset="0%" stopColor={color} stopOpacity={0.22} />
							<stop offset="100%" stopColor={color} stopOpacity={0.02} />
						</linearGradient>
					</defs>
					{geo.breaks.map((b) => (
						<line
							key={b}
							x1={b * VB_W}
							x2={b * VB_W}
							y1={0}
							y2={height}
							stroke="#94a3b8"
							strokeOpacity={0.35}
							strokeDasharray="3 3"
							vectorEffect="non-scaling-stroke"
						/>
					))}
					{geo.baseY != null && (
						<line
							x1={0}
							x2={VB_W}
							y1={geo.baseY}
							y2={geo.baseY}
							stroke="#64748b"
							strokeOpacity={0.6}
							strokeDasharray="4 4"
							vectorEffect="non-scaling-stroke"
						/>
					)}
					<path d={geo.area} fill={`url(#${gradientId})`} />
					<path
						d={geo.line}
						fill="none"
						stroke={color}
						strokeWidth={1.5}
						strokeLinejoin="round"
						vectorEffect="non-scaling-stroke"
					/>
				</svg>

				{showAxis && (
					<>
						<span className="pointer-events-none absolute left-1 top-0.5 text-[10px] tabular-nums text-muted-foreground">
							{formatPrice(hi)}
						</span>
						<span className="pointer-events-none absolute bottom-0.5 left-1 text-[10px] tabular-nums text-muted-foreground">
							{formatPrice(lo)}
						</span>
						{prevClose != null && (
							<>
								<span className="pointer-events-none absolute right-1 top-0.5 text-[10px] tabular-nums text-red-600">
									{formatPct(pctOf(hi, prevClose))}
								</span>
								<span className="pointer-events-none absolute bottom-0.5 right-1 text-[10px] tabular-nums text-green-600">
									{formatPct(pctOf(lo, prevClose))}
								</span>
							</>
						)}
					</>
				)}

				{hoverPoint && hoverCoord && (
					<>
						<div
							className="pointer-events-none absolute inset-y-0 w-px bg-slate-400/70"
							style={{ left: `${(hoverCoord[0] / VB_W) * 100}%` }}
						/>
						<div
							className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
							style={{
								left: `${(hoverCoord[0] / VB_W) * 100}%`,
								top: `${(hoverCoord[1] / height) * 100}%`,
								backgroundColor: color,
							}}
						/>
						<div
							className={cn(
								'pointer-events-none absolute top-1 z-10 whitespace-nowrap rounded-md bg-white/95 px-2 py-1 text-[11px] leading-tight shadow-md ring-1 ring-black/5',
								hoverCoord[0] / VB_W > 0.6 ? '-translate-x-[calc(100%+8px)]' : 'translate-x-2',
							)}
							style={{ left: `${(hoverCoord[0] / VB_W) * 100}%` }}
						>
							<div className="text-muted-foreground">
								{formatZonedHm(hoverPoint[0], timeZone)}
								{market !== 'cn' && market !== 'hk' && (
									<>
										{' '}
										{tzLabel} · 北京 {formatZonedHm(hoverPoint[0], 'Asia/Shanghai')}
									</>
								)}
							</div>
							<div className="tabular-nums">
								<span className="font-medium">{formatPrice(hoverPoint[1])}</span>
								{hoverPct != null && (
									<span
										className={cn(
											'ml-1.5',
											hoverPct > 0 ? 'text-red-600' : hoverPct < 0 ? 'text-green-600' : '',
										)}
									>
										{formatPct(hoverPct)}
									</span>
								)}
							</div>
						</div>
					</>
				)}
			</div>

			{showAxis && sessions.length > 0 && (
				<div className="relative mt-1 h-4 text-[10px] tabular-nums text-muted-foreground">
					<span className="absolute left-0">{formatZonedHm(sessions[0][0], timeZone)}</span>
					{geo.breaks.map((b, i) => (
						<span key={b} className="absolute -translate-x-1/2" style={{ left: `${b * 100}%` }}>
							{formatZonedHm(sessions[i][1], timeZone)}/
							{formatZonedHm(sessions[i + 1][0], timeZone)}
						</span>
					))}
					<span className="absolute right-0">
						{formatZonedHm(sessions[sessions.length - 1][1], timeZone)}
						{market !== 'cn' && <span className="ml-1">（{tzLabel}）</span>}
					</span>
				</div>
			)}
		</div>
	)
}
