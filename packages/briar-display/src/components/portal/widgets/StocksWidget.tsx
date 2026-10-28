'use client'

import { getStockQuotes } from '@/api/markets'
import { changeColorClass, formatPct, formatPrice } from '@/components/markets/marketUtils'
import { unwrap, useMarketPolling } from '@/components/markets/useMarketPolling'
import { stockId } from '@/components/markets/watchlistOps'
import { useWatchlist } from '@/components/markets/watchlistStore'
import type { StockQuote, StockRef } from '@briar/shared'
import { useEffect, useMemo, useState } from 'react'
import { WidgetChrome } from '../WidgetChrome'
import type { WidgetSize } from '../widgetTypes'

/** 自选为空时的展示用默认标的（不写入自选） */
const DEFAULT_REFS: StockRef[] = [
	{ market: 'cn', code: '600519', name: '贵州茅台' },
	{ market: 'cn', code: '300750', name: '宁德时代' },
	{ market: 'cn', code: '601318', name: '中国平安' },
	{ market: 'us', code: 'AAPL', name: 'Apple' },
	{ market: 'hk', code: '00700', name: '腾讯控股' },
]

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
	const usingDefaults = watchlist.ready && watchlist.items.length === 0
	const refs: StockRef[] = usingDefaults
		? DEFAULT_REFS
		: watchlist.items.map(({ market, code, name }) => ({ market, code, name }))
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
		const id = window.setInterval(() => setIdx((i) => (i + 1) % refs.length), 4000)
		return () => clearInterval(id)
	}, [refs.length])

	const pageSize = size === '2x2' ? 3 : 4
	const page = refs.slice(0, Math.max(refs.length, pageSize))
	// 轮播：以 idx 为起点取 pageSize 条（环形）
	const visible =
		page.length === 0
			? []
			: Array.from(
					{ length: Math.min(pageSize, page.length) },
					(_, i) => page[(idx + i) % page.length],
				)

	return (
		<WidgetChrome
			title="自选股"
			caption="Actions"
			editing={editing}
			onRemove={onRemove}
			bodyClassName="flex flex-col"
			tilt={0.5}
		>
			{!watchlist.ready || (loading && !data) ? (
				<p className="py-6 text-center text-sm text-muted-foreground">加载行情…</p>
			) : (
				<>
					{usingDefaults && (
						<p className="mb-1.5 text-[11px] text-muted-foreground">
							暂无自选，展示热门示例 ·{' '}
							<a
								href="/briar/markets"
								className="underline decoration-[color:var(--rv-rose)]/50 underline-offset-2 hover:text-foreground"
							>
								去加自选
							</a>
						</p>
					)}
					<ul className="flex flex-1 flex-col justify-center divide-y divide-[color:var(--rv-navy)]/10">
						{visible.map((item) => {
							const q = quotes.get(stockId(item))
							return (
								<li
									key={stockId(item)}
									className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0"
								>
									<a
										href="/briar/markets"
										className="flex min-w-0 flex-1 items-center gap-2 outline-none transition hover:opacity-90"
									>
										<span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
										<span className="w-16 shrink-0 text-right text-sm tabular-nums sm:w-20">
											{q ? formatPrice(q.price) : '—'}
										</span>
										<span
											className={`w-14 shrink-0 text-right text-sm font-medium tabular-nums sm:w-16 ${changeColorClass(q?.changePct)}`}
										>
											{q ? formatPct(q.changePct) : '—'}
										</span>
									</a>
								</li>
							)
						})}
					</ul>
					{refs.length > pageSize && (
						<div className="mt-2 flex justify-center gap-1">
							{refs.map((r, i) => (
								<span
									key={stockId(r)}
									aria-hidden
									className={
										i === idx % refs.length
											? 'h-1.5 w-1.5 rounded-full bg-[color:var(--rv-rose-deep)]'
											: 'h-1.5 w-1.5 rounded-full bg-[color:var(--rv-navy)]/20'
									}
								/>
							))}
						</div>
					)}
				</>
			)}
		</WidgetChrome>
	)
}
