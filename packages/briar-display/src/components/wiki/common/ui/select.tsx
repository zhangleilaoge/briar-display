import { SelectTrigger as BaseSelectTrigger } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import * as React from 'react'

const WikiSelectTrigger = React.forwardRef<
	React.ElementRef<typeof BaseSelectTrigger>,
	React.ComponentPropsWithoutRef<typeof BaseSelectTrigger>
>(({ className, ...props }, ref) => (
	<BaseSelectTrigger
		ref={ref}
		className={cn(
			'h-8 rounded-sm px-2.5 py-1 text-[13px] focus:border-primary focus:ring-0 focus:ring-offset-0',
			className,
		)}
		{...props}
	/>
))
WikiSelectTrigger.displayName = 'WikiSelectTrigger'

export { WikiSelectTrigger }
