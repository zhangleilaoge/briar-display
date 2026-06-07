'use client'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Calendar as CalendarIcon } from 'lucide-react'
import * as React from 'react'

interface DatePickerProps {
	value?: Date
	onChange?: (date: Date | undefined) => void
	placeholder?: string
	className?: string
}

function DatePicker({ value, onChange, placeholder = '选择日期', className }: DatePickerProps) {
	const [open, setOpen] = React.useState(false)

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					className={cn(
						'h-8 w-full justify-start text-left font-normal text-xs',
						!value && 'text-muted-foreground',
						className,
					)}
				>
					<CalendarIcon className="mr-2 h-3.5 w-3.5" />
					{value ? format(value, 'yyyy-MM-dd HH:mm', { locale: zhCN }) : placeholder}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="start">
				<Calendar
					mode="single"
					selected={value}
					onSelect={(date) => {
						onChange?.(date)
						if (date) setOpen(false)
					}}
					initialFocus
				/>
			</PopoverContent>
		</Popover>
	)
}

interface DateRangePickerProps {
	start?: Date
	end?: Date
	onStartChange?: (date: Date | undefined) => void
	onEndChange?: (date: Date | undefined) => void
	className?: string
}

function DateRangePicker({
	start,
	end,
	onStartChange,
	onEndChange,
	className,
}: DateRangePickerProps) {
	return (
		<div className={cn('flex items-center gap-1', className)}>
			<DatePicker value={start} onChange={onStartChange} placeholder="开始日期" />
			<span className="shrink-0 text-xs text-muted-foreground">至</span>
			<DatePicker value={end} onChange={onEndChange} placeholder="结束日期" />
		</div>
	)
}

export { DatePicker, DateRangePicker }
