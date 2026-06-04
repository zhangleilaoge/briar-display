'use client'

import { cn } from '@/lib/utils'

interface RouteLoaderProps {
	loading: boolean
}

export default function RouteLoader({ loading }: RouteLoaderProps) {
	return (
		<div
			className={cn(
				'fixed left-0 top-0 z-[60] h-[3px] w-full overflow-hidden transition-opacity duration-300',
				loading ? 'opacity-100' : 'pointer-events-none opacity-0',
			)}
		>
			<div className="wiki-route-bar h-full w-full bg-[#3366cc]" />
		</div>
	)
}
