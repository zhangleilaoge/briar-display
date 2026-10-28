'use client'

import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

/** 剪纸风格小组件外壳：软阴影、邮票角饰、大圆角；无 3D 贴纸 */
export function WidgetChrome({
	title,
	caption,
	children,
	className,
	bodyClassName,
	editing,
	onRemove,
	tilt = 0,
}: {
	title?: string
	caption?: string
	children: ReactNode
	className?: string
	bodyClassName?: string
	editing?: boolean
	onRemove?: () => void
	tilt?: number
}) {
	return (
		<div
			className={cn('group/widget relative h-full min-h-0', editing && 'rv-jiggle', className)}
			style={tilt ? { rotate: `${tilt}deg` } : undefined}
		>
			{/* 底层轻微叠纸 */}
			<div
				aria-hidden
				className="rv-paper-back pointer-events-none absolute inset-x-1 -bottom-1 top-2 -rotate-[1.4deg] rounded-[1.35rem] opacity-70"
			/>
			<div
				className={cn(
					'relative z-[1] flex h-full min-h-0 flex-col overflow-hidden rounded-[1.35rem]',
					'border border-[color:var(--rv-navy)]/20 bg-[color-mix(in_srgb,var(--rv-cream)_92%,white)]',
					'shadow-[0_10px_28px_-12px_hsl(221_46%_20%/0.28),0_2px_0_hsl(0_0%_100%/0.75)_inset]',
				)}
			>
				{(title || caption) && (
					<header className="flex shrink-0 items-baseline justify-between gap-2 px-3.5 pb-0.5 pt-3 sm:px-4 sm:pt-3.5">
						<div className="min-w-0">
							{caption && (
								<span className="rv-script block truncate text-sm leading-none text-[color:var(--rv-rose-deep)]">
									{caption}
								</span>
							)}
							{title && (
								<h3 className="truncate font-heading text-sm font-semibold text-foreground sm:text-base">
									{title}
								</h3>
							)}
						</div>
						{/* 角章点缀 */}
						<span
							aria-hidden
							className="h-2 w-2 shrink-0 rounded-full border border-[color:var(--rv-rose)]/50 bg-[var(--rv-pink)] shadow-[inset_0_0_0_1px_hsl(0_0%_100%/0.55)]"
						/>
					</header>
				)}
				<div className={cn('min-h-0 flex-1 px-3.5 pb-3.5 pt-1.5 sm:px-4 sm:pb-4', bodyClassName)}>
					{children}
				</div>
			</div>
			{editing && onRemove && (
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation()
						onRemove()
					}}
					aria-label={`移除${title || '小组件'}`}
					className="absolute -left-1.5 -top-1.5 z-[2] flex h-6 w-6 items-center justify-center rounded-full border border-[color:var(--rv-navy)]/25 bg-[color-mix(in_srgb,var(--rv-ink)_88%,black)] text-[11px] font-semibold text-[var(--rv-cream)] shadow-md transition hover:scale-105"
				>
					−
				</button>
			)}
		</div>
	)
}
