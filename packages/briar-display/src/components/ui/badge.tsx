import { cn } from '@/lib/utils'
import { type VariantProps, cva } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'

const badgeVariants = cva(
	'inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-control border px-2.5 font-control text-[12px] font-medium leading-none tracking-control transition-colors focus-visible:outline-none focus-visible:shadow-focus [&_svg]:h-3 [&_svg]:w-3',
	{
		variants: {
			variant: {
				default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
				secondary:
					'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
				destructive:
					'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
				outline: 'text-foreground',
				// 语义状态（token 见 theme.css --success / --warning / --info / --danger / --plum）
				success: 'border-transparent bg-success-soft text-success',
				warning: 'border-transparent bg-warning-soft text-warning',
				info: 'border-transparent bg-info-soft text-info',
				danger: 'border-transparent bg-danger-soft text-danger',
				plum: 'border-transparent bg-plum-soft text-plum',
				muted: 'border-transparent bg-muted text-muted-foreground',
			},
		},
		defaultVariants: {
			variant: 'default',
		},
	},
)

export interface BadgeProps
	extends HTMLAttributes<HTMLSpanElement>,
		VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
	return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

interface CountBadgeProps extends HTMLAttributes<HTMLSpanElement> {
	variant?: 'danger' | 'muted'
}

function CountBadge({ className, variant = 'muted', ...props }: CountBadgeProps) {
	return (
		<span
			className={cn(
				'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-sans text-xs font-semibold leading-none tracking-normal tabular-nums',
				variant === 'danger' ? 'bg-danger text-white' : 'bg-muted text-foreground',
				className,
			)}
			{...props}
		/>
	)
}

export { Badge, badgeVariants, CountBadge }
