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
				<radialGradient
					id={surfaceId}
					cx="0"
					cy="0"
					r="1"
					gradientUnits="userSpaceOnUse"
					gradientTransform="translate(8 6) rotate(48) scale(19)"
				>
					<stop stopColor="#fffef8" />
					<stop offset="0.62" stopColor="#f2e6d4" />
					<stop offset="1" stopColor="#cbb59b" />
				</radialGradient>
			</defs>
			<circle
				cx="12"
				cy="12"
				r="11"
				fill={`url(#${surfaceId})`}
				stroke="#b59b82"
				strokeWidth="0.8"
			/>
			<circle cx="12" cy="12" r="8.7" fill="none" stroke="#fff9e9" strokeWidth="0.9" />
			<circle
				cx="12"
				cy="12"
				r="7.6"
				fill="none"
				stroke="#bca58c"
				strokeOpacity="0.55"
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
					fill="#826c58"
					stroke="#fff3dc"
					strokeWidth="0.5"
				/>
			))}
			<g fill="none" strokeLinecap="round">
				<path
					d="M8.8 8.8C9.5 10.5 14.5 13.5 15.2 15.2M15.2 8.8C14.5 10.5 9.5 13.5 8.8 15.2"
					stroke="#806853"
					strokeOpacity="0.45"
					strokeWidth="1.9"
				/>
				<path
					d="M8.8 8.8C9.5 10.5 14.5 13.5 15.2 15.2M15.2 8.8C14.5 10.5 9.5 13.5 8.8 15.2"
					stroke="#f2dfbf"
					strokeWidth="1.35"
				/>
				<path
					d="M8.65 8.7C9.4 10.45 14.4 13.45 15.05 15.15M15.05 8.7C14.4 10.45 9.4 13.45 8.65 15.15"
					stroke="#fff8e7"
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
