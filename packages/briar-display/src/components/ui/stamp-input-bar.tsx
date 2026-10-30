'use client'

/** 邮票齿边输入条。 */
import { cn } from '@/lib/utils'
import { forwardRef } from 'react'
import { Input } from './input'

export interface StampInputBarProps extends React.ComponentProps<typeof Input> {
	wrapperClassName?: string
}

export const StampInputBar = forwardRef<HTMLInputElement, StampInputBarProps>(
	({ className, wrapperClassName, ...props }, ref) => {
		return (
			<div className={cn('relative', wrapperClassName)}>
				<div className="rv-stamp-edge rv-surface flex items-center gap-2 bg-card p-3 shadow-raised">
					<Input
						ref={ref}
						className={cn(
							'h-10 border-dashed border-[color:var(--rv-rose)] bg-transparent font-display text-base italic shadow-none placeholder:text-muted-foreground/70',
							className,
						)}
						{...props}
					/>
				</div>
			</div>
		)
	},
)
StampInputBar.displayName = 'StampInputBar'
