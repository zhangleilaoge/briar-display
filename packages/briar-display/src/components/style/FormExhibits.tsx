import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from '@/components/ui/command'
import { DatePicker, DateRangePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { StampInputBar } from '@/components/ui/stamp-input-bar'
import { Switch } from '@/components/ui/switch'
import { ResizableTextarea } from '@/components/ui/textarea'
import { useState } from 'react'
import { StyleExhibit, StyleSection } from './StyleSection'

export function FormExhibits() {
	const [checked, setChecked] = useState(true)
	const [enabled, setEnabled] = useState(true)
	const [volume, setVolume] = useState([42])
	const [date, setDate] = useState<Date | undefined>(() => new Date())
	const [start, setStart] = useState<Date | undefined>()
	const [end, setEnd] = useState<Date | undefined>()
	const [command, setCommand] = useState('按钮')

	return (
		<StyleSection
			id="forms"
			index="02"
			title="输入与选择"
			caption="Formulaires"
			description="所有控件都可以直接输入、切换或选择；键盘导航和焦点样式与业务页面保持一致。"
		>
			<div className="grid gap-4 lg:grid-cols-2">
				<StyleExhibit title="Input / Label / Textarea" source="ui/input.tsx · ui/textarea.tsx">
					<div className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="style-name">展品名称</Label>
							<Input id="style-name" placeholder="输入一个名称" defaultValue="纸上陈列室" />
						</div>
						<div className="space-y-2">
							<Label htmlFor="style-note">备注</Label>
							<ResizableTextarea id="style-note" placeholder="记录一些设计笔记…" rows={3} />
						</div>
						<Input disabled value="禁用输入框" readOnly aria-label="禁用输入框" />
					</div>
				</StyleExhibit>

				<StyleExhibit
					title="Checkbox / Switch / Slider"
					source="ui/checkbox.tsx · ui/switch.tsx · ui/slider.tsx"
				>
					<div className="space-y-6">
						<div className="flex items-center gap-3">
							<Checkbox
								id="style-checkbox"
								checked={checked}
								onCheckedChange={(value) => setChecked(value === true)}
							/>
							<Label htmlFor="style-checkbox">收录到展品清单</Label>
						</div>
						<div className="flex items-center justify-between gap-4">
							<Label htmlFor="style-switch">启用交互动效</Label>
							<Switch id="style-switch" checked={enabled} onCheckedChange={setEnabled} />
						</div>
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<Label htmlFor="style-slider">展示密度</Label>
								<Badge variant="outline">{volume[0]}%</Badge>
							</div>
							<Slider
								id="style-slider"
								value={volume}
								onValueChange={setVolume}
								max={100}
								step={1}
								aria-label="展示密度"
							/>
						</div>
					</div>
				</StyleExhibit>
			</div>

			<StyleExhibit title="Select 选择器" source="ui/select.tsx">
				<div className="max-w-sm">
					<Select defaultValue="paper">
						<SelectTrigger aria-label="选择展品材质">
							<SelectValue placeholder="选择材质" />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								<SelectLabel>容器</SelectLabel>
								<SelectItem value="paper">手账纸</SelectItem>
								<SelectItem value="glass">奥术玻璃</SelectItem>
							</SelectGroup>
							<SelectSeparator />
							<SelectGroup>
								<SelectLabel>状态</SelectLabel>
								<SelectItem value="disabled" disabled>
									暂不可用
								</SelectItem>
							</SelectGroup>
						</SelectContent>
					</Select>
				</div>
			</StyleExhibit>

			<div className="grid gap-4 xl:grid-cols-2">
				<StyleExhibit
					title="Calendar 日历"
					source="ui/calendar.tsx"
					contentClassName="overflow-x-auto"
				>
					<Calendar mode="single" selected={date} onSelect={setDate} className="mx-auto w-fit" />
				</StyleExhibit>
				<StyleExhibit title="DatePicker 日期选择" source="ui/date-picker.tsx">
					<div className="space-y-5">
						<div className="space-y-2">
							<Label>单日</Label>
							<DatePicker value={date} onChange={setDate} />
						</div>
						<div className="space-y-2">
							<Label>日期范围</Label>
							<DateRangePicker
								start={start}
								end={end}
								onStartChange={setStart}
								onEndChange={setEnd}
								className="flex-col items-stretch sm:flex-row sm:items-center"
							/>
						</div>
					</div>
				</StyleExhibit>
			</div>

			<StyleExhibit title="StampInputBar 邮票输入条" source="ui/stamp-input-bar.tsx">
				<StampInputBar placeholder="输入关键词，试试这件真实组件…" aria-label="邮票输入条" />
			</StyleExhibit>

			<StyleExhibit title="Command 命令面板" source="ui/command.tsx">
				<div className="mx-auto max-w-xl">
					<div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
						当前选择 <Badge>{command}</Badge>
					</div>
					<Command className="border border-border/60">
						<CommandInput placeholder="搜索组件…" />
						<CommandList>
							<CommandEmpty>没有匹配的组件</CommandEmpty>
							<CommandGroup heading="基础组件">
								{['按钮', '选择器', '日历', '弹窗'].map((item) => (
									<CommandItem key={item} value={item} onSelect={setCommand}>
										{item}
										<CommandShortcut>↵</CommandShortcut>
									</CommandItem>
								))}
							</CommandGroup>
							<CommandSeparator />
							<CommandGroup heading="主题">
								<CommandItem value="手账贴纸" onSelect={setCommand}>
									手账贴纸
								</CommandItem>
								<CommandItem value="奥术 HUD" onSelect={setCommand}>
									奥术 HUD
								</CommandItem>
							</CommandGroup>
						</CommandList>
					</Command>
				</div>
			</StyleExhibit>
		</StyleSection>
	)
}
