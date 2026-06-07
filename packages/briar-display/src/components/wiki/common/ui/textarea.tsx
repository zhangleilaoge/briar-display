import * as React from 'react'

import { cn } from '@/lib/utils'

const WikiTextarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
	({ className, ...props }, ref) => {
		return (
			<textarea
				className={cn(
					'flex min-h-[80px] w-full rounded-sm border border-input bg-background px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
					className,
				)}
				ref={ref}
				{...props}
			/>
		)
	},
)
WikiTextarea.displayName = 'WikiTextarea'

export { WikiTextarea }
