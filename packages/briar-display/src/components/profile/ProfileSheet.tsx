'use client'

import { PROFILE_PAPER, PaperSheet } from '@/components/ui/paper-sheet'
import { cn } from '@/lib/utils'
import type { HTMLAttributes, ReactNode } from 'react'

/**
 * 个人中心卡片外壳：统一 index 索引卡纸样（PROFILE_PAPER），不再用蓝灰 Card 边框。
 */
export function ProfileSheet({
	children,
	className,
	bodyClassName,
	...rest
}: {
	children: ReactNode
	bodyClassName?: string
} & HTMLAttributes<HTMLDivElement>) {
	return (
		<PaperSheet
			variant={PROFILE_PAPER}
			className={cn(className)}
			bodyClassName={cn('space-y-3', bodyClassName)}
			{...rest}
		>
			{children}
		</PaperSheet>
	)
}

export function ProfileSheetHeader({
	title,
	description,
	icon,
	actions,
	className,
}: {
	title: ReactNode
	description?: ReactNode
	icon?: ReactNode
	actions?: ReactNode
	className?: string
}) {
	return (
		<div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
			<div className="min-w-0 space-y-1">
				<h3 className="flex items-center gap-2 font-heading text-base font-semibold leading-none tracking-tight">
					{icon}
					{title}
				</h3>
				{description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
			</div>
			{actions}
		</div>
	)
}
