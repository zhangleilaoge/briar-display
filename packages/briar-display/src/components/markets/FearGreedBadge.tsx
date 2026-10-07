'use client'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { FEAR_GREED_BANDS, type FearGreedResult } from '@briar/shared'
import { useRef, useState } from 'react'
import { fearGreedBarColor, fearGreedStyle, fearGreedText } from './fearGreedUi'

/** 0–100 渐变条 + 当前位置 */
function Gauge({ score }: { score: number }) {
	return (
		<div
			className="relative mt-1 h-2 rounded-full"
			style={{
				background: 'linear-gradient(90deg, hsl(140 65% 48%), hsl(70 65% 50%), hsl(0 65% 48%))',
			}}
		>
			<div
				className="absolute top-1/2 h-3.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white bg-foreground shadow"
				style={{ left: `${Math.min(100, Math.max(0, score))}%` }}
			/>
		</div>
	)
}

export function FearGreedDetail({ result }: { result: FearGreedResult }) {
	const t = fearGreedText(result.score)
	const valid = result.components.filter((c) => c.score != null).length
	return (
		<div className="space-y-2 text-xs">
			<div className="flex items-baseline justify-between gap-2">
				<span className="truncate text-sm font-medium">{result.name} 恐贪指数</span>
				<span
					className="shrink-0 text-base font-semibold tabular-nums"
					style={{ color: fearGreedStyle(result.score).color }}
				>
					{t.value} {t.label}
				</span>
			</div>
			{result.score != null && <Gauge score={result.score} />}
			<div className="flex justify-between text-[10px] text-muted-foreground">
				{FEAR_GREED_BANDS.map((b) => (
					<span key={b.band}>{b.label}</span>
				))}
			</div>
			{result.components.length === 0 ? (
				<p className="text-muted-foreground">{result.reason || '暂无数据'}</p>
			) : (
				<ul className="space-y-1.5">
					{result.components.map((c) => (
						<li key={c.key}>
							<div className="flex items-center justify-between gap-2">
								<span>{c.label}</span>
								<span className="tabular-nums font-medium">
									{c.score == null ? '—' : Math.round(c.score)}
								</span>
							</div>
							<div className="mt-0.5 h-1 rounded-full bg-muted">
								{c.score != null && (
									<div
										className="h-1 rounded-full"
										style={{
											width: `${Math.max(2, c.score)}%`,
											backgroundColor: fearGreedBarColor(c.score),
										}}
									/>
								)}
							</div>
							<div className="mt-0.5 text-[11px] text-muted-foreground">{c.detail}</div>
						</li>
					))}
				</ul>
			)}
			<p className="border-t pt-1.5 text-[11px] text-muted-foreground">
				{valid} 项等权平均（越高越贪婪）{result.asOf ? ` · 日 K 截至 ${result.asOf}` : ''}
				{result.reason && result.components.length > 0 ? ` · ${result.reason}` : ''}
			</p>
		</div>
	)
}

/** 小徽章「62 贪婪」：悬停或点击展开分项；没有数据显示「—」 */
export default function FearGreedBadge({
	result,
	loading = false,
	compact = false,
	className,
}: {
	result: FearGreedResult | null | undefined
	loading?: boolean
	/** 小屏只显示数字 */
	compact?: boolean
	className?: string
}) {
	const [open, setOpen] = useState(false)
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	const t = fearGreedText(result?.score)
	const hover = (next: boolean) => {
		clearTimeout(timer.current)
		timer.current = setTimeout(() => setOpen(next), next ? 120 : 180)
	}
	const badge = (
		<span
			className={cn(
				'inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-[11px] font-medium tabular-nums leading-none',
				className,
			)}
			style={fearGreedStyle(result?.score)}
		>
			{loading && !result ? '…' : t.value}
			{t.label && <span className={cn(compact && 'hidden sm:inline')}>{t.label}</span>}
		</span>
	)
	if (!result) return <span title={loading ? '恐贪指数计算中' : '暂无恐贪指数'}>{badge}</span>
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				asChild
				onMouseEnter={() => hover(true)}
				onMouseLeave={() => hover(false)}
				onClick={(e) => e.stopPropagation()}
			>
				<button
					type="button"
					aria-label={`恐贪指数 ${t.value} ${t.label}，查看分项`}
					className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					{badge}
				</button>
			</PopoverTrigger>
			<PopoverContent
				className="w-72 p-3"
				align="end"
				onMouseEnter={() => hover(true)}
				onMouseLeave={() => hover(false)}
				onOpenAutoFocus={(e) => e.preventDefault()}
			>
				<FearGreedDetail result={result} />
			</PopoverContent>
		</Popover>
	)
}
