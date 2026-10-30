'use client'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type * as React from 'react'
import { DayPicker } from 'react-day-picker'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
	return (
		<DayPicker
			showOutsideDays={showOutsideDays}
			className={cn('p-3', className)}
			classNames={{
				months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
				month: 'space-y-4',
				month_caption: 'flex justify-center pt-1 relative items-center',
				month_grid: 'w-full border-collapse space-y-1',
				caption_label: 'text-sm font-medium',
				nav: 'space-x-1 flex items-center',
				button_previous: cn(
					buttonVariants({ variant: 'default' }),
					'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1',
				),
				button_next: cn(
					buttonVariants({ variant: 'default' }),
					'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1',
				),
				weekdays: 'flex',
				weekday: 'text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]',
				week: 'flex w-full mt-2',
				// 格子勿对任意 aria-selected 铺方角 accent，否则会与选中圆点叠出墨色方块黑边
				day: 'h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected].day-range-middle)]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20',
				day_button: cn(
					buttonVariants({ variant: 'ghost' }),
					'h-9 w-9 p-0 font-normal aria-selected:opacity-100 aria-selected:bg-transparent aria-selected:hover:bg-transparent',
				),
				range_end: 'day-range-end',
				// 选中态走 row-selected + radius-control：scrapbook 粉圆，arcane 藏青直角；勿用 bg-primary 方角墨块
				selected:
					'rv-cal-day-selected rounded-[var(--radius-control)] bg-[hsl(var(--row-selected))] text-[hsl(var(--row-selected-fg))] hover:bg-[hsl(var(--row-selected))] hover:text-[hsl(var(--row-selected-fg))] focus:bg-[hsl(var(--row-selected))] focus:text-[hsl(var(--row-selected-fg))]',
				today: 'bg-accent/60 text-foreground font-semibold ring-1 ring-primary/30',
				outside:
					'day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30',
				disabled: 'text-muted-foreground opacity-50',
				range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
				hidden: 'invisible',
				...classNames,
			}}
			components={{
				Chevron: ({ orientation }) => {
					const Icon = orientation === 'left' ? ChevronLeft : ChevronRight
					return <Icon className="h-4 w-4" />
				},
			}}
			{...props}
		/>
	)
}
Calendar.displayName = 'Calendar'

export { Calendar }
