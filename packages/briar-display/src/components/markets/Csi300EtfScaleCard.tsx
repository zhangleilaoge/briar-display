'use client'

import { getCsi300EtfScale } from '@/api/markets'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, RefreshCw, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import Csi300EtfScaleChart from './Csi300EtfScaleChart'
import { StaleBadge } from './MarketStatusBar'
import { formatAmount } from './marketUtils'
import { unwrap, useMarketPolling } from './useMarketPolling'

type ScaleMode = 'video' | 'actual'
type ChartRange = 'all' | 'year'

export default function Csi300EtfScaleCard() {
	const [mode, setMode] = useState<ScaleMode>('video')
	const [range, setRange] = useState<ChartRange>('all')
	const { data, error, loading, refreshing, refresh } = useMarketPolling(
		async () => unwrap(await getCsi300EtfScale()),
		(result) => result.pollMs,
		[],
	)
	const isVideo = mode === 'video'
	const points = useMemo(() => {
		const all = data?.points ?? []
		const cutoff = data
			? new Date(Date.parse(`${data.asOf}T00:00:00Z`) - 365 * 86_400_000).toISOString().slice(0, 10)
			: ''
		return (range === 'year' ? all.filter((point) => point.date >= cutoff) : all).map((point) => ({
			date: point.date,
			indexClose: point.indexClose,
			ratioPct: isVideo ? point.videoRatioPct : point.ratioPct,
			totalAssets: isVideo ? point.videoValue : point.totalAssets,
		}))
	}, [data, range, isVideo])
	const latest = points.at(-1)

	return (
		<Card className="glass rounded-2xl">
			<CardContent className="space-y-4 p-4 sm:p-5">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div>
						<div className="flex items-center gap-2">
							<TrendingUp className="h-4 w-4 text-warning" />
							<h2 className="text-base font-medium">头部沪深300ETF占比</h2>
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							{isVideo
								? '4只样本ETF份额 × 累计净值 ÷ 沪深300流通市值'
								: '4只样本ETF实际规模 ÷ 沪深300流通市值'}
							{data && <span className="ml-1">· 官方数据截至 {data.asOf}</span>}
						</p>
					</div>
					<Button
						variant="default"
						size="sm"
						onClick={refresh}
						disabled={refreshing}
						aria-label="刷新ETF占比"
					>
						<RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
						刷新
					</Button>
				</div>

				<div className="flex flex-wrap gap-2">
					<Tabs value={mode} onValueChange={(value) => setMode(value as ScaleMode)}>
						<TabsList aria-label="占比计算口径">
							<TabsTrigger value="video">视频口径</TabsTrigger>
							<TabsTrigger value="actual">实际规模</TabsTrigger>
						</TabsList>
					</Tabs>
					<Tabs value={range} onValueChange={(value) => setRange(value as ChartRange)}>
						<TabsList aria-label="图表时间范围">
							<TabsTrigger value="all">全部</TabsTrigger>
							<TabsTrigger value="year">近一年</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>

				{loading && !data ? (
					<div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						加载官方历史快照…
					</div>
				) : !data ? (
					<div className="flex h-[280px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
						<p>{error || '暂无头部沪深300ETF历史快照'}</p>
						<Button variant="default" size="sm" onClick={refresh} disabled={refreshing}>
							重试
						</Button>
					</div>
				) : points.length === 0 ? (
					<p className="py-16 text-center text-sm text-muted-foreground">暂无该范围的官方快照</p>
				) : (
					<>
						{latest && (
							<div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
								<span className="text-2xl font-semibold tabular-nums text-warning">
									{latest.ratioPct.toFixed(3)}%
								</span>
								<span className="text-sm text-muted-foreground">
									{isVideo ? '四只累计净值计算值' : '四只实际规模合计'}{' '}
									<span className="font-medium text-foreground">
										{formatAmount(latest.totalAssets)}
									</span>
								</span>
								<span className="text-xs text-muted-foreground">
									{range === 'all' ? '2022年10月以来' : '近一年'}官方完整月份
								</span>
							</div>
						)}
						<Csi300EtfScaleChart
							data={points}
							ratioLabel={isVideo ? '视频占比' : '规模占比'}
							amountLabel={isVideo ? '累计净值计算值' : '实际规模'}
							className="h-[280px] sm:h-[320px]"
						/>
						<div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
							{data.funds.map((fund) => (
								<div key={fund.code} className="min-w-0 rounded-xl border bg-card/45 p-3">
									<div className="flex items-center justify-between gap-2">
										<span className="truncate text-sm" title={fund.name}>
											{fund.name.replace('沪深300ETF', '')}
										</span>
										<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
											{fund.code}
										</span>
									</div>
									<p className="mt-2 font-medium tabular-nums">
										{formatAmount(isVideo ? fund.cumulativeValue : fund.assets)}
									</p>
									<p className="mt-0.5 text-[11px] leading-4 text-muted-foreground tabular-nums">
										{formatAmount(fund.shares)}份 · {isVideo ? '累计净值' : '单位净值'}{' '}
										{(isVideo ? fund.cumulativeNav : fund.unitNav).toFixed(4)}
									</p>
								</div>
							))}
						</div>
					</>
				)}

				<div className="space-y-2 text-xs text-muted-foreground">
					<p>官方月报发布后补齐完整月份，未公布的当月不估算。份额与两种净值按交易日对齐。</p>
					<details className="rounded-lg bg-card/40 px-3 py-2">
						<summary className="cursor-pointer select-none">计算公式与数据来源</summary>
						<div className="mt-2 space-y-1.5 leading-5">
							<p>实际规模 = 当日份额 × 当日单位净值；视频口径 = 当日份额 × 当日累计净值。</p>
							<p>占比 = 四只ETF对应计算值之和 ÷ 当日沪深300流通市值 × 100%。</p>
							<p>视频口径用于复现参考曲线；累计净值含历史分红，其乘积不代表实际资产规模。</p>
							{data?.sources.map((source) => (
								<p key={source}>{source}</p>
							))}
						</div>
					</details>
					<p>
						仅为华泰柏瑞510300、华夏510330、嘉实159919、易方达510310四只头部ETF样本，
						不代表中央汇金或“国家队”真实持仓；不含其他ETF、场外及联接基金。非投资建议。
					</p>
					{data?.stale && <StaleBadge error={data.error} />}
					{data && error && <p className="text-warning">刷新失败：{error}，继续显示上次快照。</p>}
				</div>
			</CardContent>
		</Card>
	)
}
