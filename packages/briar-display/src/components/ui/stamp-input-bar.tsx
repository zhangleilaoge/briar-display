'use client'

/**
 * 邮票齿边输入条：左侧怀表线稿、右侧墨水瓶钢笔剪影（各素材全站仅此一处）。
 */
import { cn } from '@/lib/utils'
import { forwardRef } from 'react'
import { Input } from './input'
import { InkwellPen, PocketWatch } from './ornaments'

export interface StampInputBarProps extends React.ComponentProps<typeof Input> {
	wrapperClassName?: string
}

export const StampInputBar = forwardRef<HTMLInputElement, StampInputBarProps>(
	({ className, wrapperClassName, ...props }, ref) => {
		return (
			<div className={cn('relative', wrapperClassName)}>
				<div className="rv-stamp-edge rv-surface flex items-center gap-2 bg-card px-3 py-3 pl-12 pr-14 shadow-raised sm:pl-14 sm:pr-16">
					<Input
						ref={ref}
						className={cn(
							'h-10 border-dashed border-[color:var(--rv-rose)] bg-transparent font-display text-base italic shadow-none placeholder:text-muted-foreground/70',
							className,
						)}
						{...props}
					/>
				</div>
				<PocketWatch className="absolute -left-3 top-1/2 h-14 w-auto -translate-y-1/2 -rotate-12 sm:h-16" />
				<InkwellPen className="absolute -right-2 top-1/2 h-11 w-11 -translate-y-1/2 rotate-[8deg] sm:h-12 sm:w-12" />
			</div>
		)
	},
)
StampInputBar.displayName = 'StampInputBar'
