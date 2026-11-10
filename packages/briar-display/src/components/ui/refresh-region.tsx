import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

interface RefreshRegionProps {
	children: ReactNode
	refreshing: boolean
	label?: string
	className?: string
}

/** 已有内容的重新请求：保留子树，仅以非阻塞遮罩标示刷新。 */
export function RefreshRegion({
	children,
	refreshing,
	label = '正在刷新…',
	className,
}: RefreshRegionProps) {
	return (
		<div
			className={cn('relative min-w-0', className)}
			aria-busy={refreshing}
			data-slot="refresh-region"
		>
			{children}
			{refreshing && (
				<div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-background/45 backdrop-blur-[1px] rv-fade-in">
					<output className="flex items-center gap-2 rounded-full border bg-background/95 px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
						<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
						{label}
					</output>
				</div>
			)}
		</div>
	)
}
