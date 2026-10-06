'use client'

import { getMarketIndexTrends, getMarketOverview, getMarketSectors } from '@/api/markets'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
	MARKET_LABELS,
	type MarketId,
	type MarketIndexTrendsResponse,
	type MarketOverviewItem,
	type MarketSectorsResponse,
	type SectorItem,
	type SectorKind,
	type SectorSortKey,
} from '@briar/shared'
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Loader2, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import IndexTrendCards from './IndexTrendCards'
import MarketChartPanel, { type ChartSubject } from './MarketChartPanel'
import { SessionBadge, StaleBadge } from './MarketStatusBar'
import MarketsShell from './MarketsShell'
import SectorHeatmap from './SectorHeatmap'
import SectorList from './SectorList'
import { SORT_LABELS, formatShanghaiTime, sortSectors } from './marketUtils'
import { unwrap, useMarketPolling } from './useMarketPolling'

type ViewMode = 'both' | 'heatmap' | 'list'

interface SectorsBundle {
	sectors: MarketSectorsResponse
	overview: MarketOverviewItem | null
	trends: MarketIndexTrendsResponse | null
	fetchedAt: number
}

/** 指数 / 分时取不到不影响板块；板块取不到才算失败 */
async function loadBundle(
	market: MarketId,
	kind: SectorKind,
	level?: string,
): Promise<SectorsBundle> {
	const [sectorsRes, overviewRes, trendsRes] = await Promise.allSettled([
		getMarketSectors(market, kind, level),
		getMarketOverview(),
		getMarketIndexTrends(market),
	])
	if (sectorsRes.status === 'rejected') throw sectorsRes.reason
	const sectors = unwrap(sectorsRes.value)
	let overview: MarketOverviewItem | null = null
	if (overviewRes.status === 'fulfilled' && overviewRes.value.success) {
		overview = overviewRes.value.data?.markets.find((m) => m.market === market) ?? null
	}
	const trends =
		trendsRes.status === 'fulfilled' && trendsRes.value.success
			? (trendsRes.value.data ?? null)
			: null
	return { sectors, overview, trends, fetchedAt: Date.now() }
}

export default function MarketSectorsPage({ market }: { market: MarketId }) {
	const [kind, setKind] = useState<SectorKind>('industry')
	const [level, setLevel] = useState<string | undefined>(market === 'cn' ? '1' : undefined)
	const [sortKey, setSortKey] = useState<SectorSortKey>('changePct')
	const [direction, setDirection] = useState<'desc' | 'asc'>('desc')
	const [view, setView] = useState<ViewMode>('both')
	const [subject, setSubject] = useState<ChartSubject | null>(null)
	const openSector = (item: SectorItem) =>
		setSubject({
			target: 'sector',
			code: item.code,
			name: item.name,
			subName: item.rawName,
			price: item.price,
			changePct: item.changePct,
			sector: item,
		})

	const queryLevel = kind === 'industry' ? level : undefined
	const { data, error, loading, refreshing, refresh } = useMarketPolling(
		() => loadBundle(market, kind, queryLevel),
		(d) => d.sectors.session.pollMs,
		[market, kind, queryLevel],
	)

	// 已有数据时的轮询失败只提示，不清空页面
	useEffect(() => {
		if (error && data) toast.error(`行情刷新失败：${error}`)
	}, [error, data])

	const sectors = data?.sectors
	const switching =
		loading || (sectors && (sectors.kind !== kind || (queryLevel && sectors.level !== queryLevel)))
	const effectiveSort: SectorSortKey = sectors?.sortKeys.includes(sortKey) ? sortKey : 'changePct'
	const sorted = useMemo(
		() => (sectors ? sortSectors(sectors.items, effectiveSort, direction) : []),
		[sectors, effectiveSort, direction],
	)
	const kindOption = sectors?.kinds.find((k) => k.kind === kind)

	return (
		<MarketsShell market={market}>
			<div className="space-y-4">
				{/* 大盘 + 状态 */}
				<Card className="glass rounded-2xl">
					<CardContent className="space-y-3 p-4 sm:p-5">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<div className="flex flex-wrap items-center gap-2">
								<h1 className="text-lg font-semibold tracking-tight">
									{MARKET_LABELS[market]}板块
								</h1>
								{sectors && <SessionBadge session={sectors.session} />}
								{sectors &&
									(sectors.realtime ? (
										<Badge
											variant="outline"
											className="border-transparent bg-sky-500/10 text-sky-700"
										>
											实时
										</Badge>
									) : (
										<Badge
											variant="outline"
											className="border-transparent bg-amber-500/10 text-amber-700"
										>
											延迟 {sectors.delayMinutes} 分钟
										</Badge>
									))}
								{sectors?.listMode === 'fixed-proxy' && sectors.proxyNote && (
									<Badge
										variant="outline"
										className="border-transparent bg-violet-500/10 text-violet-700"
									>
										{sectors.proxyNote}
									</Badge>
								)}
								{sectors?.stale && <StaleBadge error={sectors.error} />}
							</div>
							<Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
								<RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
								刷新
							</Button>
						</div>
						{data?.overview ? (
							<IndexTrendCards
								market={market}
								indices={data.overview.indices}
								trends={data.trends}
								loading={loading}
								onSelect={(idx, code) =>
									setSubject({
										target: 'index',
										code,
										name: idx.name,
										price: idx.price,
										changePct: idx.changePct,
									})
								}
							/>
						) : (
							!loading && <p className="text-sm text-muted-foreground">指数暂不可用</p>
						)}
						{sectors && (
							<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
								<span>行情时间 {formatShanghaiTime(sectors.quoteTime)}（北京时间）</span>
								<span>页面刷新 {formatShanghaiTime(data?.fetchedAt)}</span>
								<span>当地时段 {sectors.session.sessionText}</span>
								<span>数据源 {sectors.source}</span>
								<span>净流入口径 {sectors.netInflowBasis ?? '该市场数据源不提供资金流'}</span>
								<span>
									{sectors.listMode === 'dynamic' ? '板块列表从数据源实时拉取' : '固定代理列表'} ·
									共 {sectors.items.length} 个
								</span>
							</div>
						)}
					</CardContent>
				</Card>

				{/* 控制条 */}
				<div className="flex flex-wrap items-center gap-2">
					{sectors && sectors.kinds.length > 1 && (
						<Tabs value={kind} onValueChange={(v) => setKind(v as SectorKind)}>
							<TabsList>
								{sectors.kinds.map((k) => (
									<TabsTrigger key={k.kind} value={k.kind}>
										{k.label}
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>
					)}
					{kind === 'industry' && kindOption?.levels && (
						<Select value={level} onValueChange={setLevel}>
							<SelectTrigger className="h-9 w-[132px] bg-white/60">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{kindOption.levels.map((l) => (
									<SelectItem key={l.value} value={l.value}>
										{l.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
					{sectors && sectors.sortKeys.length > 1 && (
						<Select value={effectiveSort} onValueChange={(v) => setSortKey(v as SectorSortKey)}>
							<SelectTrigger className="h-9 w-[140px] bg-white/60">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{sectors.sortKeys.map((k) => (
									<SelectItem key={k} value={k}>
										按{SORT_LABELS[k]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}
					<Button
						variant="outline"
						size="sm"
						className="h-9 bg-white/60"
						onClick={() => setDirection((d) => (d === 'desc' ? 'asc' : 'desc'))}
						title="切换排序方向"
					>
						{direction === 'desc' ? (
							<ArrowDownWideNarrow className="h-4 w-4" />
						) : (
							<ArrowUpNarrowWide className="h-4 w-4" />
						)}
						{direction === 'desc'
							? effectiveSort === 'changePct'
								? '涨幅榜'
								: '从高到低'
							: effectiveSort === 'changePct'
								? '跌幅榜'
								: '从低到高'}
					</Button>
					<Tabs value={view} onValueChange={(v) => setView(v as ViewMode)} className="ml-auto">
						<TabsList>
							<TabsTrigger value="both">全部</TabsTrigger>
							<TabsTrigger value="heatmap">热力图</TabsTrigger>
							<TabsTrigger value="list">列表</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>

				{/* 主体 */}
				{!sectors ? (
					loading ? (
						<div className="flex items-center justify-center py-24 text-muted-foreground">
							<Loader2 className="mr-2 h-5 w-5 animate-spin" />
							加载板块中…
						</div>
					) : (
						<div className="py-24 text-center text-sm text-muted-foreground">
							{error || '加载失败'}，稍后会自动重试
						</div>
					)
				) : (
					<div
						className={
							switching ? 'pointer-events-none opacity-60 transition-opacity' : 'transition-opacity'
						}
					>
						{view !== 'list' && (
							<Card className="glass mb-4 rounded-2xl">
								<CardContent className="p-3 sm:p-4">
									<SectorHeatmap
										items={sorted}
										sortKey={effectiveSort}
										amountCurrency={sectors.amountCurrency}
										onSelect={openSector}
									/>
								</CardContent>
							</Card>
						)}
						{view !== 'heatmap' && (
							<Card className="glass rounded-2xl">
								<CardContent className="p-2 sm:p-4">
									<SectorList
										key={`${sectors.kind}-${sectors.level ?? ''}`}
										items={sorted}
										sortKey={effectiveSort}
										amountCurrency={sectors.amountCurrency}
										netInflowBasis={sectors.netInflowBasis}
										onSelect={openSector}
									/>
								</CardContent>
							</Card>
						)}
					</div>
				)}
				<MarketChartPanel
					market={market}
					subject={subject}
					amountCurrency={sectors?.amountCurrency ?? ''}
					onClose={() => setSubject(null)}
				/>
				<p className="text-center text-xs text-muted-foreground/80">
					红涨绿跌 · 点击指数或板块看分时 / K 线 · 交易时段约每 20
					秒自动刷新，休市时显示最近收盘数据 · 仅供参考，不构成投资建议
				</p>
			</div>
		</MarketsShell>
	)
}
