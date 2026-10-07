'use client'

import { getFearGreedBoard } from '@/api/markets'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { type FearGreedResult, MARKET_LABELS } from '@briar/shared'
import { Gauge, Loader2 } from 'lucide-react'
import { useState } from 'react'
import FearGreedBadge from './FearGreedBadge'
import { StaleBadge } from './MarketStatusBar'
import { unwrap, useMarketPolling } from './useMarketPolling'

type Tab = 'indices' | 'sectors'
const PREVIEW = 5

function Row({ item, showMarket }: { item: FearGreedResult; showMarket?: boolean }) {
	return (
		<div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-white/60">
			<span className="min-w-0 truncate text-sm" title={item.name}>
				{item.name}
				{showMarket && (
					<span className="ml-1.5 text-[11px] text-muted-foreground">
						{MARKET_LABELS[item.market]}
					</span>
				)}
			</span>
			<FearGreedBadge result={item} />
		</div>
	)
}

/** 概览页「恐贪指数」：A股主要指数 + 恒指 / 恒生科技，申万一级行业（切换） */
export default function FearGreedBoardCard() {
	const [tab, setTab] = useState<Tab>('indices')
	const [showAll, setShowAll] = useState(false)
	const { data, error, loading } = useMarketPolling(
		async () => unwrap(await getFearGreedBoard()),
		(d) => d.pollMs,
		[],
	)
	const sectors = data?.sectors ?? []
	const scored = sectors.filter((s) => s.score != null)

	return (
		<Card className="glass rounded-2xl">
			<CardContent className="space-y-3 p-4 sm:p-5">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<Gauge className="h-4 w-4 text-muted-foreground" />
						<h2 className="text-base font-medium">恐贪指数</h2>
						<span className="text-xs text-muted-foreground">0 极度恐惧 – 100 极度贪婪</span>
					</div>
					<div className="flex rounded-lg border bg-white/60 p-0.5 text-xs">
						{(
							[
								['indices', '大盘指数'],
								['sectors', '申万行业'],
							] as const
						).map(([key, label]) => (
							<button
								key={key}
								type="button"
								onClick={() => setTab(key)}
								className={cn(
									'rounded-md px-2.5 py-1',
									tab === key
										? 'bg-foreground text-background'
										: 'text-muted-foreground hover:text-foreground',
								)}
							>
								{label}
							</button>
						))}
					</div>
				</div>

				{loading && !data ? (
					<div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						计算中…
					</div>
				) : !data ? (
					<p className="py-6 text-center text-sm text-muted-foreground">{error || '暂无数据'}</p>
				) : tab === 'indices' ? (
					<div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
						{data.indices.map((i) => (
							<Row key={`${i.market}:${i.code}`} item={i} showMarket={i.market !== 'cn'} />
						))}
					</div>
				) : sectors.length === 0 ? (
					<p className="py-6 text-center text-sm text-muted-foreground">
						{data.sectorSource || '暂无行业数据'}
					</p>
				) : showAll || scored.length <= PREVIEW * 2 ? (
					<div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
						{sectors.map((s) => (
							<Row key={s.code} item={s} />
						))}
					</div>
				) : (
					<div className="grid gap-x-6 sm:grid-cols-2">
						<div>
							<div className="px-2 pb-1 text-xs text-muted-foreground">最贪婪</div>
							{scored.slice(0, PREVIEW).map((s) => (
								<Row key={s.code} item={s} />
							))}
						</div>
						<div>
							<div className="px-2 pb-1 text-xs text-muted-foreground">最恐惧</div>
							{scored
								.slice(-PREVIEW)
								.reverse()
								.map((s) => (
									<Row key={s.code} item={s} />
								))}
						</div>
					</div>
				)}

				{data && (
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
						{tab === 'sectors' && sectors.length > PREVIEW * 2 && (
							<Button
								variant="ghost"
								size="sm"
								className="h-6 px-2 text-xs"
								onClick={() => setShowAll((v) => !v)}
							>
								{showAll ? '只看两端' : `显示全部 ${sectors.length} 个行业`}
							</Button>
						)}
						<span>
							按日 K 计算：均线偏离、RSI、动量、量能、波动率、52 周位置
							{tab === 'sectors' ? '、主力净流入' : ''} 等权平均 · 约 5 分钟刷新 · 悬停或点击看分项
						</span>
						{data.stale && <StaleBadge error={data.error} />}
					</div>
				)}
			</CardContent>
		</Card>
	)
}
