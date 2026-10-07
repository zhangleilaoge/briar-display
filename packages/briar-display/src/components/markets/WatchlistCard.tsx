'use client'

import { getFearGreed, getStockQuotes, searchStocks } from '@/api/markets'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
	type FearGreedResult,
	MARKET_LABELS,
	type StockQuote,
	type StockRef,
	type StockSearchItem,
	WATCHLIST_LIMIT,
} from '@briar/shared'
import { Loader2, Plus, Search, Star, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import FearGreedBadge from './FearGreedBadge'
import { StaleBadge } from './MarketStatusBar'
import { displayCode } from './constituents'
import { changeColorClass, formatPct, formatPrice, formatShanghaiTime } from './marketUtils'
import { readableError, unwrap, useMarketPolling } from './useMarketPolling'
import { stockId } from './watchlistOps'
import { useWatchlist } from './watchlistStore'

const SEARCH_DEBOUNCE_MS = 300

/** 输入防抖 */
function useDebounced<T>(value: T, ms: number): T {
	const [v, setV] = useState(value)
	useEffect(() => {
		const t = setTimeout(() => setV(value), ms)
		return () => clearTimeout(t)
	}, [value, ms])
	return v
}

function MarketTag({ market }: { market: StockRef['market'] }) {
	return (
		<Badge
			variant="outline"
			className="shrink-0 border-transparent bg-muted px-1.5 py-0 text-[10px] font-normal"
		>
			{MARKET_LABELS[market]}
		</Badge>
	)
}

/** 搜索框 + 结果下拉：跨市场搜所有个股（不只是自选），可直接加自选或打开详情 */
function StockSearch({ onOpen }: { onOpen: (s: StockRef) => void }) {
	const watchlist = useWatchlist()
	const [input, setInput] = useState('')
	const [open, setOpen] = useState(false)
	const [results, setResults] = useState<StockSearchItem[] | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [searching, setSearching] = useState(false)
	const query = useDebounced(input.trim(), SEARCH_DEBOUNCE_MS)
	const boxRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!query) {
			setResults(null)
			setError(null)
			return
		}
		const ctrl = new AbortController()
		setSearching(true)
		searchStocks(query, ctrl.signal)
			.then((res) => {
				setResults(unwrap(res).items)
				setError(null)
			})
			.catch((err) => {
				if (ctrl.signal.aborted) return
				setResults(null)
				setError(readableError(err))
			})
			.finally(() => {
				if (!ctrl.signal.aborted) setSearching(false)
			})
		return () => ctrl.abort()
	}, [query])

	// 点外面收起
	useEffect(() => {
		const onDown = (e: MouseEvent) => {
			if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
		}
		document.addEventListener('mousedown', onDown)
		return () => document.removeEventListener('mousedown', onDown)
	}, [])

	const showPanel = open && input.trim().length > 0

	return (
		<div ref={boxRef} className="relative">
			<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				value={input}
				onChange={(e) => {
					setInput(e.target.value)
					setOpen(true)
				}}
				onFocus={() => setOpen(true)}
				onKeyDown={(e) => {
					if (e.key === 'Escape') setOpen(false)
				}}
				placeholder="搜索全部市场个股：代码 / 名称 / 拼音首字母（如 gzmt、AAPL、00700、삼성）"
				className="bg-white/70 pl-9"
				aria-label="搜索个股"
			/>
			{showPanel && (
				<div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-xl border bg-background p-1 shadow-lg">
					{searching && !results ? (
						<div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							搜索中…
						</div>
					) : error ? (
						<div className="py-6 text-center text-sm text-muted-foreground">{error}</div>
					) : results && results.length === 0 ? (
						<div className="py-6 text-center text-sm text-muted-foreground">没有找到匹配的个股</div>
					) : (
						(results ?? []).map((r) => {
							const inList = watchlist.has(r)
							return (
								<div
									key={stockId(r)}
									className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted"
								>
									<button
										type="button"
										className="flex min-w-0 flex-1 items-center gap-2 text-left"
										onClick={() => {
											setOpen(false)
											onOpen(r)
										}}
									>
										<MarketTag market={r.market} />
										<span className="shrink-0 text-xs text-muted-foreground tabular-nums">
											{displayCode(r.code)}
										</span>
										<span className="truncate text-sm">{r.name}</span>
										{(r.type === 'etf' || r.exchange) && (
											<span className="hidden shrink-0 text-[11px] text-muted-foreground/80 sm:inline">
												{[r.exchange, r.type === 'etf' ? 'ETF' : ''].filter(Boolean).join(' · ')}
											</span>
										)}
									</button>
									<Button
										variant={inList ? 'ghost' : 'outline'}
										size="sm"
										className="h-7 shrink-0 px-2 text-xs"
										disabled={!watchlist.ready}
										onClick={() => (inList ? watchlist.remove(r) : watchlist.add(r))}
										title={inList ? '移出自选' : '加入自选'}
									>
										{inList ? (
											<>
												<Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
												已自选
											</>
										) : (
											<>
												<Plus className="h-3.5 w-3.5" />
												自选
											</>
										)}
									</Button>
								</div>
							)
						})
					)}
				</div>
			)}
		</div>
	)
}

/** 概览页「自选股」卡片：搜索 + 自选列表（与大盘同一套轮询节奏） */
export default function WatchlistCard({ onOpen }: { onOpen: (s: StockRef) => void }) {
	const watchlist = useWatchlist()
	const refs = watchlist.items
	const idsKey = refs.map(stockId).join(',')
	const { data, error, loading } = useMarketPolling(
		async () => {
			if (refs.length === 0)
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
		[idsKey],
	)
	// 恐贪指数：日 K 计算，后端缓存 8 分钟，前端 5 分钟刷新一次
	const fg = useMarketPolling(
		async () => {
			if (refs.length === 0) return { items: [] as FearGreedResult[], pollMs: 5 * 60_000 }
			return unwrap(await getFearGreed(refs))
		},
		(d) => d.pollMs,
		[idsKey],
	)
	const fearGreed = useMemo(
		() => new Map((fg.data?.items ?? []).map((r) => [stockId(r), r])),
		[fg.data],
	)
	const quotes = useMemo(() => new Map((data?.items ?? []).map((q) => [stockId(q), q])), [data])
	const lastTime = useMemo(
		() => Math.max(0, ...(data?.items ?? []).map((q) => q.quoteTime ?? 0)),
		[data],
	)

	return (
		<Card className="glass rounded-2xl">
			<CardContent className="space-y-3 p-4 sm:p-5">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<Star className="h-4 w-4 fill-amber-400 text-amber-500" />
						<h2 className="text-base font-medium">自选股</h2>
						{watchlist.ready && (
							<span className="text-xs text-muted-foreground">
								{refs.length} / {WATCHLIST_LIMIT}
							</span>
						)}
					</div>
					{watchlist.ready && (
						<span className="text-xs text-muted-foreground">
							{watchlist.mode === 'server'
								? '已同步到账号，多设备互通'
								: '保存在本机浏览器，登录后自动同步到账号'}
						</span>
					)}
				</div>

				<StockSearch onOpen={onOpen} />

				{!watchlist.ready ? (
					<div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						加载自选中…
					</div>
				) : refs.length === 0 ? (
					<p className="py-6 text-center text-sm text-muted-foreground">
						还没有自选股。在上方搜索个股，或在板块详情的成分股里点开个股后「加自选」
					</p>
				) : (
					<div className="divide-y rounded-xl border bg-white/40">
						{refs.map((item) => {
							const q = quotes.get(stockId(item))
							return (
								<div
									key={stockId(item)}
									className="flex items-center gap-2 px-3 py-2 hover:bg-white/60"
								>
									<button
										type="button"
										className="flex min-w-0 flex-1 items-center gap-3 text-left"
										onClick={() => onOpen(item)}
									>
										<div className="min-w-0 flex-1">
											<div className="truncate text-sm font-medium" title={item.name}>
												{item.name}
											</div>
											<div className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
												<MarketTag market={item.market} />
												{displayCode(item.code)}
												{q && q.delayMinutes > 0 && (
													<span className="text-amber-700">延迟{q.delayMinutes}分</span>
												)}
											</div>
										</div>
										<div className="w-20 text-right text-sm font-medium tabular-nums sm:w-24">
											{q ? formatPrice(q.price) : loading ? '…' : '--'}
										</div>
										<div
											className={cn(
												'w-16 text-right text-sm font-medium tabular-nums sm:w-20',
												changeColorClass(q?.changePct),
											)}
										>
											{q ? formatPct(q.changePct) : '--'}
										</div>
									</button>
									<div className="flex w-12 justify-end sm:w-[5.5rem]">
										<FearGreedBadge
											result={fearGreed.get(stockId(item))}
											loading={fg.loading}
											compact
										/>
									</div>
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
										onClick={() => watchlist.remove(item)}
										title="移出自选"
										aria-label={`移出自选 ${item.name}`}
									>
										<X className="h-4 w-4" />
									</Button>
								</div>
							)
						})}
					</div>
				)}
				{refs.length > 0 && (
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
						{lastTime > 0 && <span>最新行情 {formatShanghaiTime(lastTime)}</span>}
						<span>
							交易时段约 20 秒刷新 · 港股 / 美股 / 日股延迟 15 分钟 · 恐贪指数按日 K
							计算，悬停或点击徽章看分项
						</span>
						{data?.stale && <StaleBadge error={data.error} />}
						{error && !data && <span>{error}</span>}
					</div>
				)}
			</CardContent>
		</Card>
	)
}
