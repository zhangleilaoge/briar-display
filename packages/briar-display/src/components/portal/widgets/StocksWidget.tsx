'use client'

import { getMarketChart, getStockQuotes } from '@/api/markets'
import { changeColorClass, formatPct, formatPrice } from '@/components/markets/marketUtils'
import { unwrap, useMarketPolling } from '@/components/markets/useMarketPolling'
import { stockId } from '@/components/markets/watchlistOps'
import { useWatchlist } from '@/components/markets/watchlistStore'
import type { StockQuote, StockRef } from '@briar/shared'
import { useEffect, useMemo, useState } from 'react'
import { WidgetChrome } from '../WidgetChrome'
import type { WidgetSize } from '../widgetTypes'
import { sparklineGeometry } from './stockSparkline'

/** 自选为空时的展示用默认标的（不写入自选） */
const DEFAULT_REFS: StockRef[] = [
	{ market: 'cn', code: '600519', name: '贵州茅台' },
	{ market: 'cn', code: '300750', name: '宁德时代' },
	{ market: 'cn', code: '601318', name: '中国平安' },
	{ market: 'us', code: 'AAPL', name: 'Apple' },
	{ market: 'hk', code: '00700', name: '腾讯控股' },
]

function formatChange(change: number | null | undefined): string {
	if (change == null) return '—'
	return `${change > 0 ? '+' : ''}${change.toFixed(2)}`
}

/** 从报价构造简易火花线（无分时数据时兜底） */
function syntheticSpark(q: StockQuote | undefined): number[] {
	if (!q || q.price == null) return []
	const prev = q.prevClose ?? q.open ?? q.price
	const open = q.open ?? prev
	const high = q.high ?? Math.max(open, q.price)
	const low = q.low ?? Math.min(open, q.price)
	const mid = (open + q.price) / 2
	return [prev, open, low, mid, high, (high + q.price) / 2, q.price]
}

function downsample(values: number[], n = 28): number[] {
	if (values.length <= n) return values
	const out: number[] = []
	for (let i = 0; i < n; i++) {
		const idx = Math.round((i / (n - 1)) * (values.length - 1))
		out.push(values[idx])
	}
	return out
}

function Sparkline({
	values,
	baseline,
	up,
	className,
}: {
	values: number[]
	baseline?: number | null
	up: boolean | null
	className?: string
}) {
	if (values.length < 2) {
		return <div className={className} aria-hidden />
	}
	const geometry = sparklineGeometry(values, baseline)
	const stroke =
		up == null
			? 'color-mix(in srgb, var(--rv-navy) 45%, transparent)'
			: up
				? 'var(--rv-rose-deep)'
				: 'hsl(152 45% 38%)'
	return (
		<svg viewBox="0 0 100 36" className={className} preserveAspectRatio="none" aria-hidden>
			{geometry.baselineY != null && (
				<line
					x1="0"
					x2="100"
					y1={geometry.baselineY}
					y2={geometry.baselineY}
					stroke="color-mix(in srgb, var(--rv-navy) 30%, transparent)"
					strokeWidth="0.75"
					strokeDasharray="3 3"
					vectorEffect="non-scaling-stroke"
				/>
			)}
			<polyline
				fill="none"
				stroke={stroke}
				strokeWidth="1.75"
				strokeLinecap="round"
				strokeLinejoin="round"
				points={geometry.points}
			/>
		</svg>
	)
}

export function StocksWidget({
	size,
	editing,
	onRemove,
}: {
	size: WidgetSize
	editing?: boolean
	onRemove?: () => void
}) {
	const watchlist = useWatchlist()
	const items = Array.isArray(watchlist.items) ? watchlist.items : []
	const usingDefaults = watchlist.ready && items.length === 0
	const refs: StockRef[] = usingDefaults
		? DEFAULT_REFS
		: items.map(({ market, code, name, type }) => ({ market, code, name, type }))
	const idsKey = refs.map(stockId).join(',')

	const { data, loading } = useMarketPolling(
		async () => {
			if (!refs.length)
				return {
					items: [] as StockQuote[],
					pollMs: 5 * 60_000,
					stale: false,
					error: undefined,
					fetchedAt: 0,
				}
			return unwrap(await getStockQuotes(refs))
		},
		(d) => d.pollMs,
		[idsKey, watchlist.ready],
	)

	const quotes = useMemo(() => new Map((data?.items ?? []).map((q) => [stockId(q), q])), [data])

	const [idx, setIdx] = useState(0)
	useEffect(() => {
		setIdx(0)
	}, [idsKey])
	useEffect(() => {
		if (refs.length <= 1) return
		const id = window.setInterval(() => setIdx((i) => (i + 1) % refs.length), 4500)
		return () => clearInterval(id)
	}, [refs.length])

	const current = refs.length ? refs[idx % refs.length] : null
	const currentId = current ? `${stockId(current)}:${current.type ?? 'stock'}` : ''
	const quote = current ? quotes.get(stockId(current)) : undefined

	const [spark, setSpark] = useState<{ id: string; values: number[]; baseline: number | null }>({
		id: '',
		values: [],
		baseline: null,
	})
	useEffect(() => {
		if (!current) {
			setSpark({ id: '', values: [], baseline: null })
			return
		}
		let cancelled = false
		;(async () => {
			try {
				const target = current.type === 'index' ? 'index' : 'stock'
				const body = unwrap(await getMarketChart(current.market, target, current.code, 'intraday'))
				const days = body.days ?? []
				const pts = days.flatMap((d) => d.points.map((p) => p[1])).filter((n) => Number.isFinite(n))
				if (!cancelled && pts.length >= 2) {
					setSpark({
						id: currentId,
						values: downsample(pts),
						baseline: body.prevClose ?? quote?.prevClose ?? null,
					})
					return
				}
			} catch {
				/* fall through */
			}
			if (!cancelled) {
				setSpark({
					id: currentId,
					values: syntheticSpark(quote),
					baseline: quote?.prevClose ?? null,
				})
			}
		})()
		return () => {
			cancelled = true
		}
		// quote 变化时用最新报价兜底；主依赖是当前标的
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [current?.market, current?.code, current?.type, idx, quote?.price, quote?.prevClose])

	const up = quote?.changePct == null ? null : quote.changePct === 0 ? null : quote.changePct > 0
	const wide = size === '2x1'
	const shellClass = 'flex min-h-0 flex-1 flex-col outline-none transition hover:opacity-95'
	const showLoading = !watchlist.ready || (loading && !data) || !current
	const hasSpark = spark.id === currentId && spark.values.length >= 2

	const quoteBody =
		current == null ? null : (
			<>
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0">
						<p className="truncate font-heading text-sm font-semibold leading-tight">
							{current.name}
						</p>
						<p className="truncate text-[11px] tabular-nums text-muted-foreground">
							{current.code}
							{usingDefaults ? ' · 示例' : ''}
						</p>
					</div>
					<div
						className={`shrink-0 text-right text-xs font-medium tabular-nums ${changeColorClass(quote?.changePct)}`}
					>
						<p>{formatChange(quote?.change)}</p>
						<p>{formatPct(quote?.changePct)}</p>
					</div>
				</div>

				<div className={`my-1.5 min-h-0 flex-1 ${wide ? 'px-0.5' : ''}`}>
					<Sparkline
						values={hasSpark ? spark.values : syntheticSpark(quote)}
						baseline={hasSpark ? spark.baseline : quote?.prevClose}
						up={up}
						className="h-full w-full min-h-[2.25rem]"
					/>
				</div>

				<p
					className={`font-display font-semibold tabular-nums tracking-tight text-foreground ${
						wide ? 'text-3xl' : 'text-2xl'
					}`}
				>
					{formatPrice(quote?.price)}
				</p>

				{refs.length > 1 && (
					<div className="mt-1.5 flex justify-center gap-1">
						{refs.map((r, i) => (
							<span
								key={stockId(r)}
								aria-hidden
								className={
									i === idx % refs.length
										? 'h-1 w-1 rounded-full bg-[color:var(--rv-rose-deep)]'
										: 'h-1 w-1 rounded-full bg-[color:var(--rv-navy)]/20'
								}
							/>
						))}
					</div>
				)}
			</>
		)

	return (
		<WidgetChrome
			editing={editing}
			onRemove={onRemove}
			bodyClassName="flex flex-col !pt-2.5"
			tilt={0.5}
		>
			{showLoading || !quoteBody ? (
				<p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
					加载行情…
				</p>
			) : editing ? (
				/* 编辑态不用 <a>，避免浏览器原生「拖链接」幽灵抢走整卡拖拽 */
				<div className={shellClass} draggable={false}>
					{quoteBody}
				</div>
			) : (
				<a href="/briar/markets" draggable={false} className={shellClass}>
					{quoteBody}
				</a>
			)}
		</WidgetChrome>
	)
}
