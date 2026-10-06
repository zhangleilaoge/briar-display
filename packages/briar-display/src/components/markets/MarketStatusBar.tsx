import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { MarketIndexQuote, MarketSessionInfo } from '@briar/shared'
import { AlertTriangle } from 'lucide-react'
import {
	SESSION_LABELS,
	changeColorClass,
	formatPct,
	formatPrice,
	formatShanghaiTime,
	sessionBadgeClass,
} from './marketUtils'

export function SessionBadge({ session }: { session: MarketSessionInfo }) {
	return (
		<Badge variant="outline" className={sessionBadgeClass(session.status)}>
			{session.status === 'open' && (
				<span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
			)}
			{SESSION_LABELS[session.status]}
		</Badge>
	)
}

export function StaleBadge({ error }: { error?: string }) {
	return (
		<Badge
			variant="outline"
			className="border-transparent bg-amber-500/10 text-amber-700"
			title={error ? `上游错误：${error}` : undefined}
		>
			<AlertTriangle className="mr-1 h-3 w-3" />
			数据源异常，显示最近缓存
		</Badge>
	)
}

/** 大盘指数行：名称 / 点位 / 涨跌幅（红涨绿跌） */
export function IndexList({
	indices,
	compact = false,
}: {
	indices: MarketIndexQuote[]
	compact?: boolean
}) {
	if (indices.length === 0) {
		return <p className="text-sm text-muted-foreground">指数暂不可用</p>
	}
	return (
		<div
			className={cn(
				'grid gap-x-4 gap-y-1.5',
				compact ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-4',
			)}
		>
			{indices.map((idx) => (
				<div
					key={idx.code}
					className={cn(
						'flex items-baseline justify-between gap-2',
						!compact && 'flex-col items-start rounded-xl bg-white/50 px-3 py-2',
					)}
					title={
						idx.quoteTime
							? `行情时间 ${formatShanghaiTime(idx.quoteTime)}（北京时间）${idx.delayMinutes ? `，延迟 ${idx.delayMinutes} 分钟` : ''}`
							: undefined
					}
				>
					<span className="truncate text-sm text-muted-foreground">
						{idx.name}
						{idx.delayMinutes > 0 && <span className="ml-1 text-[10px] text-amber-700">延迟</span>}
					</span>
					<span className="flex items-baseline gap-2 tabular-nums">
						<span className={cn('text-sm font-medium', !compact && 'text-base')}>
							{formatPrice(idx.price)}
						</span>
						<span className={cn('text-sm', changeColorClass(idx.changePct))}>
							{formatPct(idx.changePct)}
						</span>
					</span>
				</div>
			))}
		</div>
	)
}
