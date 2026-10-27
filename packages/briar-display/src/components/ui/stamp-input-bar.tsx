'use client'

/**
 * 邮票齿边输入条：左侧怀表、右侧钢笔（素材见 ASSETS_LICENSES.md）。内部仍是 shadcn Input，行为不变。
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
				<div className="rv-stamp-edge rv-surface flex items-center gap-2 bg-card px-3 py-3 pl-12 pr-14 sm:pl-14 sm:pr-16 shadow-raised">
					<Input
						ref={ref}
						className={cn(
							'h-10 border-dashed border-[color:var(--rv-rose)] bg-transparent font-display text-base italic shadow-none placeholder:text-muted-foreground/70',
							className,
						)}
						{...props}
					/>
				</div>
				<PocketWatch className="absolute -left-3 top-1/2 h-14 w-auto -translate-y-1/2 -rotate-12 drop-shadow sm:h-16" />
				<FountainPen className="absolute -right-3 top-1/2 h-12 w-12 -translate-y-1/2 rotate-[10deg] sm:h-14 sm:w-14" />
			</div>
		)
	},
)
StampInputBar.displayName = 'StampInputBar'
