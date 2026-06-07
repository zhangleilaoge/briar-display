import { type VariantProps, cva } from 'class-variance-authority'
import * as React from 'react'

import { Button, type ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const wikiButtonVariants = cva('', {
	variants: {
		size: {
			default: 'h-8 px-3 py-1.5 text-[13px]',
			sm: 'h-7 px-2.5 py-1 text-[12px]',
			lg: 'h-9 px-4 py-2 text-[14px]',
			icon: 'h-8 w-8',
		},
	},
	defaultVariants: {
		size: 'default',
	},
})

export interface WikiButtonProps extends Omit<ButtonProps, 'size'> {
	size?: 'default' | 'sm' | 'lg' | 'icon'
}

const WikiButton = React.forwardRef<HTMLButtonElement, WikiButtonProps>(
	({ className, size, ...props }, ref) => {
		return (
			<Button
				className={cn('rounded-sm', wikiButtonVariants({ size }), className)}
				ref={ref}
				{...props}
			/>
		)
	},
)
WikiButton.displayName = 'WikiButton'

export { WikiButton, wikiButtonVariants }
