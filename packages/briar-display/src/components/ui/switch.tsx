'use client'

import * as SwitchPrimitive from '@radix-ui/react-switch'
import * as React from 'react'

import { cn } from '@/lib/utils'

function SewnButton() {
	const surfaceId = React.useId()
	return (
		<svg
			aria-hidden="true"
			className="rv-switch-button hidden h-full w-full"
			viewBox="0 0 24 24"
			focusable="false"
		>
			<defs>
				<linearGradient id={surfaceId} x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
					<stop stopColor="#ffffff" />
					<stop offset="0.28" stopColor="#edf1f4" />
					<stop offset="0.48" stopColor="#ffffff" />
					<stop offset="0.72" stopColor="#d4dae0" />
					<stop offset="1" stopColor="#aeb6bf" />
				</linearGradient>
			</defs>
			<circle
				cx="12"
				cy="12"
				r="11"
				fill={`url(#${surfaceId})`}
				stroke="#9aa2ab"
				strokeWidth="0.8"
			/>
			<circle cx="12" cy="12" r="8.7" fill="none" stroke="#ffffff" strokeWidth="0.9" />
			<circle
				cx="12"
				cy="12"
				r="7.6"
				fill="none"
				stroke="#98a1aa"
				strokeOpacity="0.6"
				strokeWidth="0.65"
			/>
			{[
				[9, 9],
				[15, 9],
				[9, 15],
				[15, 15],
			].map(([cx, cy]) => (
				<circle
					key={`${cx}-${cy}`}
					cx={cx}
					cy={cy}
					r="1.15"
					fill="#6a4a34"
					stroke="#f8fafc"
					strokeWidth="0.45"
				/>
			))}
			<g fill="none" strokeLinecap="round">
				<path
					d="M8.8 8.8C9.5 10.5 14.5 13.5 15.2 15.2M15.2 8.8C14.5 10.5 9.5 13.5 8.8 15.2"
					stroke="#4f3525"
					strokeOpacity="0.5"
					strokeWidth="1.9"
				/>
				<path
					d="M8.8 8.8C9.5 10.5 14.5 13.5 15.2 15.2M15.2 8.8C14.5 10.5 9.5 13.5 8.8 15.2"
					stroke="#856043"
					strokeWidth="1.35"
				/>
				<path
					d="M8.65 8.7C9.4 10.45 14.4 13.45 15.05 15.15M15.05 8.7C14.4 10.45 9.4 13.45 8.65 15.15"
					stroke="#b38a64"
					strokeWidth="0.35"
				/>
			</g>
		</svg>
	)
}

const Switch = React.forwardRef<
	React.ElementRef<typeof SwitchPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
	<SwitchPrimitive.Root
		ref={ref}
		className={cn(
			'rv-switch peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-50 shadow-control data-[state=checked]:bg-primary data-[state=checked]:[background-image:var(--btn-primary-image)] data-[state=unchecked]:bg-input',
			className,
		)}
		{...props}
	>
		<SwitchPrimitive.Thumb className="rv-switch-thumb pointer-events-none block h-5 w-5 rounded-full bg-card shadow-surface ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0">
			<SewnButton />
		</SwitchPrimitive.Thumb>
	</SwitchPrimitive.Root>
))
Switch.displayName = SwitchPrimitive.Root.displayName

export { Switch }
