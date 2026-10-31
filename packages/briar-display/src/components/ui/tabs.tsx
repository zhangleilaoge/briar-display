import * as TabsPrimitive from '@radix-ui/react-tabs'
import * as React from 'react'

import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

/** 选中项底色由一枚滑块承担：切换时滑块平滑移到新 tab（仅 transform/尺寸过渡，尊重减弱动效） */
const TabsList = React.forwardRef<
	React.ElementRef<typeof TabsPrimitive.List>,
	React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, ref) => {
	const localRef = React.useRef<HTMLDivElement | null>(null)
	const indicatorRef = React.useRef<HTMLSpanElement | null>(null)
	const [ready, setReady] = React.useState(false)
	const setRefs = React.useCallback(
		(node: HTMLDivElement | null) => {
			localRef.current = node
			if (typeof ref === 'function') ref(node)
			else if (ref) ref.current = node
		},
		[ref],
	)

	React.useEffect(() => {
		const list = localRef.current
		const ind = indicatorRef.current
		if (!list || !ind) return
		let first = true
		const place = () => {
			const active = list.querySelector<HTMLElement>(':scope > [role="tab"][data-state="active"]')
			if (!active) {
				ind.style.opacity = '0'
				return
			}
			const insetY =
				Number.parseFloat(getComputedStyle(list).getPropertyValue('--tab-indicator-inset-y')) || 0
			if (first) ind.style.transition = 'none'
			ind.style.opacity = '1'
			ind.style.width = `${active.offsetWidth}px`
			ind.style.height = `${Math.max(0, active.offsetHeight - insetY * 2)}px`
			ind.style.translate = `${active.offsetLeft}px ${active.offsetTop + insetY}px`
			if (first) {
				void ind.offsetWidth
				ind.style.transition = ''
				first = false
			}
		}
		place()
		setReady(true)
		const mo = new MutationObserver(place)
		mo.observe(list, { subtree: true, attributes: true, attributeFilter: ['data-state'] })
		const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null
		ro?.observe(list)
		return () => {
			mo.disconnect()
			ro?.disconnect()
		}
	}, [])

	return (
		<TabsPrimitive.List
			ref={setRefs}
			data-tab-indicator={ready ? 'ready' : undefined}
			className={cn(
				'relative inline-flex h-10 items-center justify-center gap-0.5 rounded-control border border-[color:hsl(var(--border))] bg-[var(--tabs-list-bg)] p-1 text-muted-foreground shadow-sm',
				className,
			)}
			{...props}
		>
			<span ref={indicatorRef} aria-hidden className="rv-tab-indicator" style={{ opacity: 0 }} />
			{children}
		</TabsPrimitive.List>
	)
})
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
	React.ElementRef<typeof TabsPrimitive.Trigger>,
	React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
	<TabsPrimitive.Trigger
		ref={ref}
		className={cn(
			'inline-flex items-center justify-center whitespace-nowrap h-8 gap-1.5 rounded-control px-3 pb-1.5 pt-2 font-control text-sm font-medium leading-none tracking-control transition-all hover:text-foreground focus-visible:outline-none focus-visible:shadow-focus [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:[background-image:var(--tab-active-image)] data-[state=active]:text-[color:var(--tab-active-fg)] data-[state=active]:shadow-[var(--tab-active-shadow)]',
			className,
		)}
		{...props}
	>
		<span className="rv-control-label inline-flex items-center justify-center gap-[inherit]">
			{children}
		</span>
	</TabsPrimitive.Trigger>
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
	React.ElementRef<typeof TabsPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
	<TabsPrimitive.Content
		ref={ref}
		className={cn(
			'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
			className,
		)}
		{...props}
	/>
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
