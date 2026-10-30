'use client'

import { BinderPeel } from '@/components/portal/BinderPeel'
import { useGreeting } from '@/components/portal/greetingStore'
import { Postmark } from '@/components/ui/ornaments'
import { PaperSheet } from '@/components/ui/paper-sheet'
import { cn } from '@/lib/utils'
import { RefreshCw } from 'lucide-react'
import type { WidgetSize } from '../widgetTypes'

export function GreetingWidget({
	size: _size,
	editing,
	onRemove,
}: {
	size: WidgetSize
	editing?: boolean
	onRemove?: () => void
}) {
	const state = useGreeting()

	return (
		<div
			className={cn('relative h-full min-h-0 overflow-visible', editing && 'rv-jiggle')}
			style={{ rotate: '-1deg' }}
		>
			{/* 底层叠纸不动 */}
			<PaperSheet
				variant="binder"
				holes={5}
				aria-hidden
				className="pointer-events-none !absolute inset-x-1 -bottom-1 top-2 -rotate-[1.4deg] opacity-70"
				bodyClassName="!p-0 min-h-[100%]"
			>
				{'\u00a0'}
			</PaperSheet>
			{/* 掀整张顶层便签（孔、邮戳、纸面），不是内文框 */}
			<BinderPeel
				contentKey={state.index}
				ready={Boolean(state.greet || state.line)}
				className="relative z-[1] h-full min-h-0"
			>
				<PaperSheet
					variant="binder"
					holes={5}
					className="relative h-full min-h-0"
					bodyClassName="relative flex h-full min-h-0 flex-col !pt-3"
				>
					<div className="flex h-full min-h-0 flex-col">
						<span className="rv-label text-muted-foreground">
							{state.tod || '\u00a0'} · {state.date || '\u00a0'}
						</span>
						<h2 className="mt-1 font-display text-xl font-semibold leading-snug sm:text-2xl">
							<span className="rv-script font-normal text-[color:var(--rv-rose-deep)]">
								{state.greet || '\u00a0'}
							</span>
						</h2>
						{state.author ? (
							<p className="font-display text-xs italic text-muted-foreground/80">
								— {state.author}
							</p>
						) : null}
						<div className="mt-1 flex items-center gap-1.5">
							<p className="min-w-0 flex-1 line-clamp-3 font-display text-sm text-muted-foreground sm:text-base">
								{state.line || '\u00a0'}
							</p>
							{!editing && (
								<button
									type="button"
									onClick={state.shuffle}
									aria-label="换一句"
									title="换一句"
									className="group inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[color:var(--rv-navy)]/55 transition hover:bg-[color:var(--rv-navy)]/5 hover:text-[color:var(--rv-rose-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rv-rose)]/40"
								>
									<RefreshCw className="h-3 w-3 motion-safe:group-hover:animate-spin" aria-hidden />
								</button>
							)}
						</div>
					</div>
					<Postmark
						className="rv-binder-postmark pointer-events-none !absolute -right-1 -top-1 z-[1] h-16 w-16 rotate-12 opacity-90 sm:h-20 sm:w-20"
						date={state.date.slice(-2) || '28'}
					/>
				</PaperSheet>
			</BinderPeel>
			{editing && onRemove && (
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation()
						onRemove()
					}}
					aria-label="移除问候"
					className="absolute -left-1.5 -top-1.5 z-[2] flex h-6 w-6 items-center justify-center rounded-full border border-[color:var(--rv-navy)]/25 bg-[color-mix(in_srgb,var(--rv-ink)_88%,black)] text-[11px] font-semibold text-[var(--rv-cream)] shadow-md transition hover:scale-105"
				>
					−
				</button>
			)}
		</div>
	)
}
