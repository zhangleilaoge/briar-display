import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

/** 想法页侧栏共用打孔索引纸卡。 */
export function ThoughtsAsideBlock({
	label,
	action,
	className,
	children,
}: {
	label: string
	/** 标题行右侧（如搜索框） */
	action?: ReactNode
	className?: string
	children: ReactNode
}) {
	return (
		<section className={cn('rv-thoughts-aside relative min-w-0 overflow-hidden', className)}>
			<header className="relative flex min-h-8 items-center justify-between gap-2 border-b border-dashed border-[color:var(--rv-rose-deep)]/15 pb-2">
				<span className="truncate font-label text-xs font-medium tracking-[0.12em] text-[color:var(--rv-navy)]/70">
					{label}
				</span>
				{action}
			</header>
			<div className="relative pt-3">{children}</div>
		</section>
	)
}
