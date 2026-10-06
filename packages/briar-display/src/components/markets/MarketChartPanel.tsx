'use client'

import { getMarketChart } from '@/api/markets'
import { Badge } from '@/components/ui/badge'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
	CHART_PERIODS,
	CHART_PERIOD_LABELS,
	type ChartPeriod,
	type ChartPeriodSupport,
	type ChartTarget,
	type MarketChartResponse,
	type MarketId,
	type SectorItem,
} from '@briar/shared'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { StaleBadge } from './MarketStatusBar'
import TrendChart, { type TrendChartData } from './TrendChart'
import {
	TZ_LABELS,
	changeColorClass,
	formatAmount,
	formatPct,
	formatPrice,
	formatShanghaiTime,
} from './marketUtils'
import { unwrap, useMarketPolling } from './useMarketPolling'

/** 面板打开的标的：指数卡片或板块（热力图色块 / 列表行） */
export interface ChartSubject {
	target: ChartTarget
	code: string
	name: string
	subName?: string
	price?: number | null
	changePct?: number | null
	/** 板块附加信息 */
	sector?: SectorItem
}

interface MarketChartPanelProps {
	market: MarketId
	subject: ChartSubject | null
	amountCurrency?: string
	onClose: () => void
}

const isKline = (p: ChartPeriod): p is 'day' | 'week' | 'month' =>
	p === 'day' || p === 'week' || p === 'month'

/** 最新价 / 涨跌幅：分时相对昨收，K 线相对上一根收盘 */
function latestQuote(data: MarketChartResponse) {
	if (isKline(data.period)) {
		const [last, prev] = [
			data.candles[data.candles.length - 1],
			data.candles[data.candles.length - 2],
		]
		if (!last) return null
		return { price: last[4], pct: prev ? ((last[4] - prev[4]) / prev[4]) * 100 : null }
	}
	const day = data.days[data.days.length - 1]
	const last = day?.points[day.points.length - 1]
	if (!last) return null
	const base = day.prevClose
	return { price: last[1], pct: base ? ((last[1] - base) / base) * 100 : null }
}

function PanelBody({
	market,
	subject,
	amountCurrency = '',
}: Omit<MarketChartPanelProps, 'onClose'> & { subject: ChartSubject }) {
	const [period, setPeriod] = useState<ChartPeriod>('intraday')
	const [support, setSupport] = useState<ChartPeriodSupport[] | null>(null)

	const { data, error, loading } = useMarketPolling(
		async () => unwrap(await getMarketChart(market, subject.target, subject.code, period)),
		(d) => {
			if (!d.available) return 30 * 60_000
			// K 线交易中 1 分钟刷一次，其余时段 10 分钟；分时跟随交易时段（20s / 60s / 5min）
			if (isKline(d.period)) return d.session.status === 'open' ? 60_000 : 10 * 60_000
			return d.session.pollMs
		},
		[market, subject.target, subject.code, period],
	)

	useEffect(() => {
		if (data?.periods) setSupport(data.periods)
	}, [data])

	// 切周期 / 切标的时旧数据先不画，避免用错图表模式
	const current =
		data && data.period === period && data.code === subject.code && data.target === subject.target
			? data
			: null

	const chartData = useMemo<TrendChartData | null>(() => {
		if (!current?.available) return null
		if (isKline(current.period)) {
			return current.candles.length
				? { kind: 'candle', candles: current.candles, period: current.period }
				: null
		}
		return current.days.some((d) => d.points.length)
			? {
					kind: 'minute',
					days: current.days,
					prevClose: current.prevClose,
					multiDay: current.period === '5day',
				}
			: null
	}, [current])

	const quote = current ? latestQuote(current) : null
	const price = quote?.price ?? subject.price
	const pct = quote ? quote.pct : subject.changePct
	const label = CHART_PERIOD_LABELS[period]
	const what = subject.target === 'sector' ? '该板块' : '该指数'
	const sector = subject.sector
	const lastDay = current?.days[current.days.length - 1]
	const lastTs = lastDay?.points[lastDay.points.length - 1]?.[0]

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm tabular-nums">
				{price != null && <span className="text-lg font-semibold">{formatPrice(price)}</span>}
				<span className={cn('text-lg font-semibold', changeColorClass(pct))}>{formatPct(pct)}</span>
				{period !== 'intraday' && quote && (
					<span className="text-xs text-muted-foreground">
						{isKline(period) ? `较上一${label.replace('K', '')}收盘` : '较当日昨收'}
					</span>
				)}
				{sector?.amount != null && (
					<span className="text-muted-foreground">
						成交额 {formatAmount(sector.amount, amountCurrency)}
					</span>
				)}
				{sector?.leader && (
					<span className="text-muted-foreground">
						领涨 {sector.leader.name}{' '}
						<span className={changeColorClass(sector.leader.changePct)}>
							{formatPct(sector.leader.changePct)}
						</span>
					</span>
				)}
			</div>

			<div className="grid grid-cols-5 gap-1 rounded-lg bg-muted p-1" role="tablist">
				{CHART_PERIODS.map((p) => {
					const s = support?.find((x) => x.period === p)
					const disabled = s ? !s.available : false
					return (
						<button
							key={p}
							type="button"
							role="tab"
							aria-selected={period === p}
							aria-disabled={disabled}
							title={disabled ? s?.reason : undefined}
							onClick={() => setPeriod(p)}
							className={cn(
								'rounded-md px-1 py-1.5 text-sm font-medium transition-colors',
								period === p
									? 'bg-background text-foreground shadow'
									: 'text-muted-foreground hover:text-foreground',
								disabled &&
									'text-muted-foreground/45 line-through decoration-1 hover:text-muted-foreground/60',
							)}
						>
							{CHART_PERIOD_LABELS[p]}
						</button>
					)
				})}
			</div>

			<div className="h-[300px] sm:h-[340px]">
				{!current ? (
					<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
						{loading || data ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								加载{label}中…
							</>
						) : (
							error || '走势数据暂时不可用'
						)}
					</div>
				) : !current.available ? (
					<div className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center text-sm text-muted-foreground">
						<span>
							{what}暂无{label}数据
						</span>
						{current.reason && (
							<span className="text-xs text-muted-foreground/80">{current.reason}</span>
						)}
					</div>
				) : !chartData ? (
					<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
						{period === 'intraday' ? '今日暂无分时数据（可能尚未开盘）' : `暂无${label}数据`}
					</div>
				) : (
					<TrendChart
						data={chartData}
						timeZone={current.timeZone}
						resetKey={`${market}:${subject.target}:${subject.code}:${period}`}
						className="h-full"
					/>
				)}
			</div>

			{current?.available && (
				<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
					{current.delayMinutes > 0 ? (
						<Badge variant="outline" className="border-transparent bg-amber-500/10 text-amber-700">
							延迟 {current.delayMinutes} 分钟
						</Badge>
					) : (
						<Badge variant="outline" className="border-transparent bg-sky-500/10 text-sky-700">
							实时
						</Badge>
					)}
					{current.stale && <StaleBadge error={current.error} />}
					{isKline(period) ? (
						<span>前复权 · MA5 / MA10 / MA20 · 可拖动、双指缩放</span>
					) : (
						<>
							<span>横轴为{TZ_LABELS[market]}时间（午休压缩）</span>
							{lastTs && <span>末笔 {formatShanghaiTime(lastTs)}（北京时间）</span>}
							{current.prevClose != null && (
								<span>
									{period === '5day' ? '基准为首日昨收' : '虚线为昨收'}{' '}
									{formatPrice(current.prevClose)}
								</span>
							)}
						</>
					)}
					<span>数据源 {current.source}</span>
				</div>
			)}
		</div>
	)
}

/** 同花顺式走势面板：分时 / 五日 / 日K / 周K / 月K；指数卡片和板块共用（手机上接近全宽） */
export default function MarketChartPanel({
	market,
	subject,
	amountCurrency,
	onClose,
}: MarketChartPanelProps) {
	return (
		<Dialog open={subject != null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="w-[calc(100%-1rem)] max-w-3xl rounded-2xl p-3 sm:p-6">
				{subject && (
					<>
						<DialogHeader className="text-left">
							<DialogTitle className="pr-6">
								{subject.name}
								{subject.subName && subject.subName !== subject.name && (
									<span className="ml-2 text-sm font-normal text-muted-foreground">
										{subject.subName}
									</span>
								)}
							</DialogTitle>
							<DialogDescription>
								{subject.target === 'index' ? '大盘指数' : '板块'}走势 · 红涨绿跌
							</DialogDescription>
						</DialogHeader>
						<PanelBody
							key={`${subject.target}:${subject.code}`}
							market={market}
							subject={subject}
							amountCurrency={amountCurrency}
						/>
					</>
				)}
			</DialogContent>
		</Dialog>
	)
}
