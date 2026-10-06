import { cn } from '@/lib/utils'
import type { MarketId, MarketIndexQuote, MarketIndexTrendsResponse } from '@briar/shared'
import IntradayChart from './IntradayChart'
import {
	changeColorClass,
	formatFlow,
	formatPct,
	formatPrice,
	formatShanghaiTime,
} from './marketUtils'

interface IndexTrendCardsProps {
	market: MarketId
	indices: MarketIndexQuote[]
	/** 分时整体失败时为 null：只显示点位，不画图 */
	trends: MarketIndexTrendsResponse | null
	loading?: boolean
	/** 点卡片打开走势面板（code 为接口里的指数代码） */
	onSelect?: (index: MarketIndexQuote, code: string) => void
}

/** 详情页顶部大盘指数：点位 + 涨跌幅 + 当日分时小图；点击打开走势面板 */
export default function IndexTrendCards({
	market,
	indices,
	trends,
	loading,
	onSelect,
}: IndexTrendCardsProps) {
	if (indices.length === 0) {
		return <p className="text-sm text-muted-foreground">指数暂不可用</p>
	}
	return (
		<div
			className={cn(
				'grid grid-cols-1 gap-2 sm:gap-3',
				indices.length >= 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3',
			)}
		>
			{indices.map((idx) => {
				const series = trends?.items.find((s) => s.name === idx.name)
				return (
					<button
						type="button"
						key={idx.code}
						onClick={() => onSelect?.(idx, series?.code ?? idx.name)}
						className="rounded-xl bg-white/55 px-3 pb-2 pt-2.5 text-left transition-colors hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						title="查看分时 / 五日 / K 线"
					>
						<div className="flex items-baseline justify-between gap-2">
							<span className="truncate text-sm text-muted-foreground">
								{idx.name}
								{(idx.delayMinutes > 0 || (series?.delayMinutes ?? 0) > 0) && (
									<span className="ml-1 text-[10px] text-amber-700">延迟</span>
								)}
							</span>
							<span className="flex items-baseline gap-2 tabular-nums">
								<span className="text-base font-medium">{formatPrice(idx.price)}</span>
								<span className={cn('text-sm', changeColorClass(idx.changePct))}>
									{formatPct(idx.changePct)}
								</span>
							</span>
						</div>
						{series ? (
							<IntradayChart
								series={series}
								market={market}
								timeZone={trends?.timeZone ?? 'Asia/Shanghai'}
								height={64}
								showAxis={false}
								interactive={false}
								className="mt-1.5"
								emptyText={series.source ? '今日暂无分时' : '分时暂不可用'}
							/>
						) : (
							<div className="mt-1.5 flex h-16 items-center justify-center text-xs text-muted-foreground">
								{loading ? '分时加载中…' : '分时暂不可用'}
							</div>
						)}
						{idx.flows && idx.flows.length > 0 && (
							<div
								className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] tabular-nums text-muted-foreground"
								title="正数为流入（净买入），负数为流出（净卖出）"
							>
								{idx.flows.map((f) => (
									<span key={f.label} className="whitespace-nowrap">
										{f.label}{' '}
										<span className={changeColorClass(f.value)}>
											{formatFlow(f.value, f.currency)}
										</span>
									</span>
								))}
							</div>
						)}
						{series?.tradeDate && (
							<div className="mt-0.5 text-[10px] text-muted-foreground/80">
								{series.tradeDate.slice(5)} 分时 · 末笔{' '}
								{formatShanghaiTime(series.points[series.points.length - 1]?.[0])}
							</div>
						)}
					</button>
				)
			})}
		</div>
	)
}
