import { type VariantProps, cva } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
	'inline-flex items-center justify-center whitespace-nowrap rounded-sm text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-wiki-link focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50',
	{
		variants: {
			variant: {
				default: 'bg-wiki-link text-white hover:bg-wiki-link-hover',
				secondary: 'bg-wiki-bg-secondary text-wiki-text hover:bg-wiki-bg-tertiary',
				outline:
					'border border-wiki-border-light bg-wiki-bg text-wiki-text hover:bg-wiki-bg-secondary',
				ghost: 'text-wiki-text hover:bg-wiki-bg-tertiary',
				link: 'text-wiki-link underline-offset-4 hover:underline',
			},
			size: {
				default: 'h-8 px-3 py-1.5',
				sm: 'h-7 px-2.5 py-1 text-[12px]',
				lg: 'h-9 px-4 py-2 text-[14px]',
				icon: 'h-8 w-8',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
)

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, ...props }, ref) => {
		return (
			<button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
		)
	},
)
Button.displayName = 'Button'

export { Button, buttonVariants }
