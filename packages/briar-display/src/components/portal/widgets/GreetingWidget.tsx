'use client'

import { GreetingStickers } from '@/components/portal/GreetingStickers'
import { useGreeting } from '@/components/portal/greetingStore'
import { Postmark } from '@/components/ui/ornaments'
import { cn } from '@/lib/utils'
import { RefreshCw } from 'lucide-react'
import { WidgetChrome } from '../WidgetChrome'
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
		<div className="relative h-full min-h-0 overflow-visible">
			{/* 贴纸挂在外壳光环，躲开 overflow-hidden 的白卡 */}
			<GreetingStickers kind={state.kind} seed={state.decorSeed} />
			<WidgetChrome editing={editing} onRemove={onRemove} bodyClassName="relative !pt-3" tilt={-1}>
				<span className="relative z-[1] rv-label text-muted-foreground">
					{state.tod || ' '} · {state.date || ' '}
				</span>
				<h2 className="relative z-[1] mt-1 font-display text-2xl font-semibold leading-tight sm:text-3xl">
					<span className="rv-script font-normal text-[color:var(--rv-rose-deep)]">
						{state.greet || ' '}
					</span>
				</h2>
				<div className="relative z-[1] mt-1 flex items-center gap-1.5">
					<p className="min-w-0 flex-1 line-clamp-3 font-display text-sm text-muted-foreground sm:text-base">
						{state.line || ' '}
					</p>
					{!editing && (
						<button
							type="button"
							onClick={state.shuffle}
							aria-label="换一句"
							title="换一句"
							className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[color:var(--rv-navy)]/55 transition hover:bg-[color:var(--rv-navy)]/5 hover:text-[color:var(--rv-rose-deep)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rv-rose)]/40"
						>
							<RefreshCw className={cn('h-3 w-3', state.spinning && 'animate-spin')} aria-hidden />
						</button>
					)}
				</div>
				<Postmark
					className="pointer-events-none absolute -right-1 -top-1 z-[1] h-16 w-16 rotate-12 opacity-90 sm:h-20 sm:w-20"
					date={state.date.slice(-2) || '28'}
				/>
			</WidgetChrome>
		</div>
	)
}
