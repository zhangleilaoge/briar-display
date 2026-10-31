import { type VariantProps, cva } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
	// 形状、字体、字距、大小写与投影全部来自主题 token（src/styles/theme.css）：
	// 剪贴簿 = 衬线药丸 + 粉彩渐变 + 内白描边；HUD = 直角 + 大写间距无衬线 + 发光描边
	'rv-btn inline-flex select-none items-center justify-center whitespace-nowrap rounded-control leading-none font-control text-sm font-medium tracking-control [text-transform:var(--control-transform)] transition-[box-shadow,background-color,color,filter,transform] duration-200 focus-visible:outline-none focus-visible:shadow-focus active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
	{
		variants: {
			variant: {
				default:
					'bg-secondary [background-image:var(--btn-default-image)] text-secondary-foreground shadow-control hover:shadow-control-hover',
				primary:
					'rv-btn-primary bg-primary [background-image:var(--btn-primary-image)] text-[hsl(var(--btn-primary-fg))] shadow-control hover:shadow-control-hover hover:brightness-[1.03]',
				destructive:
					'bg-destructive text-destructive-foreground shadow-control hover:bg-destructive/90 hover:shadow-control-hover',
				ghost: 'text-foreground hover:bg-accent hover:text-accent-foreground',
				link: 'text-primary underline-offset-4 hover:underline',
			},
			size: {
				default: 'h-10 px-4 py-2',
				sm: 'h-9 px-3',
				lg: 'h-11 px-8',
				icon: 'h-10 w-10 p-0',
				'icon-sm': 'h-9 w-9 p-0',
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
	({ className, variant, size, children, ...props }, ref) => {
		return (
			<button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
				<span className="rv-control-label inline-flex items-center justify-center gap-[inherit]">
					{children}
				</span>
			</button>
		)
	},
)
Button.displayName = 'Button'

export { Button, buttonVariants }
