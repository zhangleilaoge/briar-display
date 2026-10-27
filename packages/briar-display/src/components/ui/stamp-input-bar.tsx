'use client'

/**
 * 邮票齿边输入条：左侧怀表、右侧钢笔（自绘 SVG）。内部仍是 shadcn Input，行为不变。
 */
import { cn } from '@/lib/utils'
import { forwardRef } from 'react'
import { Input } from './input'
import { FountainPen, PocketWatch } from './ornaments'

export interface StampInputBarProps extends React.ComponentProps<typeof Input> {
	wrapperClassName?: string
}

export const StampInputBar = forwardRef<HTMLInputElement, StampInputBarProps>(
	({ className, wrapperClassName, ...props }, ref) => {
		return (
			<div className={cn('relative', wrapperClassName)}>
				<div className="rv-stamp-edge rv-surface flex items-center gap-2 bg-card px-3 py-3 pl-14 pr-24 shadow-raised">
					<Input
						ref={ref}
						className={cn(
							'h-10 border-dashed border-[color:var(--rv-rose)] bg-transparent font-display text-base italic shadow-none placeholder:text-muted-foreground/70',
							className,
						)}
						{...props}
					/>
				</div>
				<PocketWatch
					aria-hidden
					className="pointer-events-none absolute -left-3 top-1/2 h-16 w-14 -translate-y-1/2 -rotate-12 drop-shadow"
				/>
				<FountainPen
					aria-hidden
					className="pointer-events-none absolute -right-4 top-1/2 h-10 w-28 -translate-y-1/2 drop-shadow"
				/>
			</div>
		)
	},
)
StampInputBar.displayName = 'StampInputBar'
