'use client'

import { getStockQuote } from '@/api/markets'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MARKET_LABELS, type MarketId, type StockQuote, type StockRef } from '@briar/shared'
import { Loader2, Star } from 'lucide-react'
import { ChartPanelBody } from './MarketChartPanel'
import { SessionBadge, StaleBadge } from './MarketStatusBar'
import { displayCode } from './constituents'
import {
	changeColorClass,
	formatAmount,
	formatPct,
	formatPrice,
	formatShanghaiTime,
} from './marketUtils'
import { unwrap, useMarketPolling } from './useMarketPolling'
import { useWatchlist } from './watchlistStore'

/** 报价头里的指标格：数据源没给的不显示 */
function quoteStats(q: StockQuote): { label: string; value: string }[] {
	const cur = q.currency === 'CNY' ? '' : q.currency
	const rows: [string, number | null, (v: number) => string][] = [
		['今开', q.open, formatPrice],
		['最高', q.high, formatPrice],
		['最低', q.low, formatPrice],
		['昨收', q.prevClose, formatPrice],
		['成交额', q.amount, (v) => formatAmount(v, cur)],
		['成交量', q.volume, (v) => `${formatAmount(v)}股`],
		['换手率', q.turnoverRate, (v) => `${v.toFixed(2)}%`],
		['总市值', q.marketCap, (v) => formatAmount(v, cur)],
		['市盈率', q.pe, (v) => v.toFixed(2)],
		['市净率', q.pb, (v) => v.toFixed(2)],
	]
	return rows.flatMap(([label, v, fmt]) => (v == null ? [] : [{ label, value: fmt(v) }]))
}

/** 个股详情：报价头 + 自选按钮 + 分时/五日/日K/周K/月K（与板块共用走势面板） */
export default function StockDetailView({ market, stock }: { market: MarketId; stock: StockRef }) {
	const watchlist = useWatchlist()
	const inList = watchlist.has(stock)
	const { data, error, loading } = useMarketPolling(
		async () => unwrap(await getStockQuote(market, stock.code)),
		(d) => d.session.pollMs,
		[market, stock.code],
	)
	const current = data && data.quote.code === stock.code ? data : null
	const q = current?.quote ?? null

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0 space-y-1">
					{q ? (
						<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 tabular-nums">
							<span className={cn('text-2xl font-semibold', changeColorClass(q.changePct))}>
								{formatPrice(q.price)}
							</span>
							<span className={cn('text-base font-medium', changeColorClass(q.changePct))}>
								{q.change != null && `${q.change > 0 ? '+' : ''}${formatPrice(q.change)} `}
								{formatPct(q.changePct)}
							</span>
						</div>
					) : (
						<div className="flex h-8 items-center text-sm text-muted-foreground">
							{loading || data ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									加载行情中…
								</>
							) : (
								error || '行情暂时不可用'
							)}
						</div>
					)}
					<div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
						<Badge variant="outline" className="border-transparent bg-muted">
							{MARKET_LABELS[market]} · {displayCode(stock.code)}
						</Badge>
						{current && <SessionBadge session={current.session} />}
						{q &&
							(q.delayMinutes > 0 ? (
								<Badge
									variant="outline"
									className="border-transparent bg-amber-500/10 text-amber-700"
								>
									延迟 {q.delayMinutes} 分钟
								</Badge>
							) : (
								<Badge variant="outline" className="border-transparent bg-sky-500/10 text-sky-700">
									实时
								</Badge>
							))}
						{current?.stale && <StaleBadge error={current.error} />}
						{q?.quoteTime && <span>行情 {formatShanghaiTime(q.quoteTime)}</span>}
					</div>
				</div>
				<Button
					variant={inList ? 'secondary' : 'outline'}
					size="sm"
					disabled={!watchlist.ready}
					onClick={() =>
						inList
							? watchlist.remove(stock)
							: watchlist.add({ market, code: stock.code, name: q?.name || stock.name })
					}
					title={inList ? '移出自选' : '加入自选'}
				>
					<Star className={cn('h-4 w-4', inList && 'fill-amber-400 text-amber-500')} />
					{inList ? '已自选' : '加自选'}
				</Button>
			</div>

			{q && (
				<div className="grid grid-cols-3 gap-x-4 gap-y-1.5 rounded-lg bg-muted/50 px-3 py-2 text-xs sm:grid-cols-5">
					{quoteStats(q).map((s) => (
						<div key={s.label} className="flex justify-between gap-2 tabular-nums">
							<span className="text-muted-foreground">{s.label}</span>
							<span className="truncate font-medium">{s.value}</span>
						</div>
					))}
				</div>
			)}

			<ChartPanelBody
				market={market}
				subject={{ target: 'stock', code: stock.code, name: stock.name }}
				showQuote={false}
			/>
			{q && <p className="text-[11px] text-muted-foreground/80">报价数据源 {q.source}</p>}
		</div>
	)
}
