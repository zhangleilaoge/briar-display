'use client'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
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
	showTime?: boolean
}

function DatePicker({
	value,
	onChange,
	placeholder = '选择日期',
	className,
	showTime,
}: DatePickerProps) {
	const [open, setOpen] = React.useState(false)
	const [tempDate, setTempDate] = React.useState<Date | undefined>(value)

	const timeStr = React.useMemo(() => {
		if (!tempDate) return '00:00:00'
		const h = String(tempDate.getHours()).padStart(2, '0')
		const m = String(tempDate.getMinutes()).padStart(2, '0')
		const s = String(tempDate.getSeconds()).padStart(2, '0')
		return `${h}:${m}:${s}`
	}, [tempDate])

	React.useEffect(() => {
		setTempDate(value)
	}, [value, open])

	const handleDateSelect = (date: Date | undefined) => {
		if (!date) {
			setTempDate(undefined)
			return
		}
		const newDate = new Date(date)
		if (tempDate && showTime) {
			newDate.setHours(tempDate.getHours())
			newDate.setMinutes(tempDate.getMinutes())
			newDate.setSeconds(tempDate.getSeconds())
		}
		setTempDate(newDate)
		if (!showTime) {
			onChange?.(newDate)
			setOpen(false)
		}
	}

	const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value
		if (!val || !tempDate) return
		const [h, m, s] = val.split(':').map((v) => Number.parseInt(v, 10) || 0)
		const newDate = new Date(tempDate)
		newDate.setHours(h)
		newDate.setMinutes(m)
		newDate.setSeconds(s || 0)
		setTempDate(newDate)
	}

	const handleConfirm = () => {
		onChange?.(tempDate)
		setOpen(false)
	}

	const displayFormat = showTime ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd HH:mm'

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
					{value ? format(value, displayFormat, { locale: zhCN }) : placeholder}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="start">
				<Calendar mode="single" selected={tempDate} onSelect={handleDateSelect} initialFocus />
				{showTime && (
					<div className="border-t p-3">
						<div className="flex items-center gap-2">
							<span className="text-xs text-muted-foreground">时间</span>
							<Input
								type="time"
								step={1}
								value={timeStr}
								onChange={handleTimeChange}
								className="h-8 w-40 text-xs"
							/>
						</div>
						<div className="mt-3 flex justify-end">
							<Button size="sm" className="h-7 text-xs" onClick={handleConfirm}>
								确定
							</Button>
						</div>
					</div>
				)}
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
	showTime?: boolean
}

function DateRangePicker({
	start,
	end,
	onStartChange,
	onEndChange,
	className,
	showTime,
}: DateRangePickerProps) {
	return (
		<div className={cn('flex items-center gap-1', className)}>
			<DatePicker
				value={start}
				onChange={onStartChange}
				placeholder="开始日期"
				showTime={showTime}
			/>
			<span className="shrink-0 text-xs text-muted-foreground">至</span>
			<DatePicker value={end} onChange={onEndChange} placeholder="结束日期" showTime={showTime} />
		</div>
	)
}

export { DatePicker, DateRangePicker }
