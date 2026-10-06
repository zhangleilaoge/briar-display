'use client'

import { getMarketOverview } from '@/api/markets'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { MarketOverviewItem } from '@briar/shared'
import { ChevronRight, Loader2, RefreshCw } from 'lucide-react'
import { IndexList, SessionBadge, StaleBadge } from './MarketStatusBar'
import MarketsShell from './MarketsShell'
import { formatShanghaiTime } from './marketUtils'
import { unwrap, useMarketPolling } from './useMarketPolling'

/** 各市场入口卡片里简述板块口径 */
const MARKET_HINTS: Record<string, string> = {
	cn: '申万一/二级行业 · 概念板块',
	hk: '恒生综合行业指数',
	us: 'SPDR 行业 ETF · 主题 ETF',
	jp: 'TOPIX-17 行业 ETF（延迟 15 分钟）',
	kr: 'WICS 业种 · 主题',
}

function MarketCard({ item }: { item: MarketOverviewItem }) {
	return (
		<a href={`/briar/markets/${item.market}`} className="group block">
			<Card className="glass glass-interactive h-full rounded-2xl">
				<CardContent className="flex h-full flex-col gap-3 p-5">
					<div className="flex items-center justify-between gap-2">
						<div className="flex items-center gap-2">
							<h3 className="text-base font-medium transition-colors group-hover:text-primary">
								{item.label}
							</h3>
							<SessionBadge session={item.session} />
						</div>
						<ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
					</div>
					<p className="-mt-1 text-xs text-muted-foreground">{MARKET_HINTS[item.market]}</p>
					<div className="flex-1">
						<IndexList indices={item.indices} compact />
					</div>
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
						<span>行情 {formatShanghaiTime(item.quoteTime)}</span>
						<span>当地 {item.session.sessionText}</span>
						{item.delayNote && <span className="text-amber-700">{item.delayNote}</span>}
					</div>
					{item.stale && <StaleBadge error={item.error} />}
				</CardContent>
			</Card>
		</a>
	)
}

export default function MarketsOverviewPage() {
	const { data, error, loading, refreshing, refresh } = useMarketPolling(
		async () => unwrap(await getMarketOverview()),
		(d) => Math.min(...d.markets.map((m) => m.session.pollMs)),
		[],
	)

	return (
		<MarketsShell>
			<div className="mb-4 flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="text-xl font-semibold tracking-tight">全球板块</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						A股、港股、美股、日本、韩国主要市场的大盘与板块涨跌，红涨绿跌；时间均为北京时间
					</p>
				</div>
				<Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
					<RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
					刷新
				</Button>
			</div>
			{loading && !data ? (
				<div className="flex items-center justify-center py-24 text-muted-foreground">
					<Loader2 className="mr-2 h-5 w-5 animate-spin" />
					加载行情中…
				</div>
			) : !data ? (
				<div className="py-24 text-center text-sm text-muted-foreground">
					{error || '加载失败'}，稍后会自动重试
				</div>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{data.markets.map((item) => (
						<MarketCard key={item.market} item={item} />
					))}
				</div>
			)}
		</MarketsShell>
	)
}
