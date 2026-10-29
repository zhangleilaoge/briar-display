import { Button } from '@/components/ui/button'
import { ChatBubble } from '@/components/ui/chat-bubble'
import { Checkbox } from '@/components/ui/checkbox'
import { AutoHeight, useFlip } from '@/components/ui/motion'
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useRef, useState } from 'react'
import { StyleExhibit, StyleSection } from './StyleSection'

const INITIAL_ROWS = ['Button', 'Dialog', 'PaperSheet']

export function DataExhibits() {
	const [selected, setSelected] = useState<string[]>(['Dialog'])
	const [expanded, setExpanded] = useState(false)
	const [rows, setRows] = useState(INITIAL_ROWS)
	const listRef = useRef<HTMLUListElement>(null)
	useFlip(listRef, [rows])

	const toggleRow = (name: string, checked: boolean) => {
		setSelected((current) =>
			checked ? [...current, name] : current.filter((item) => item !== name),
		)
	}
	const move = (index: number, direction: -1 | 1) => {
		const target = index + direction
		if (target < 0 || target >= rows.length) return
		setRows((current) => {
			const next = [...current]
			;[next[index], next[target]] = [next[target], next[index]]
			return next
		})
	}

	return (
		<StyleSection
			id="content"
			index="04"
			title="内容与动效"
			caption="Contenu"
			description="内容组件不绑定数据来源；动效基础件只操作布局、位置和透明度，并尊重系统的减弱动效设置。"
		>
			<StyleExhibit title="Table 表格" source="ui/table.tsx" contentClassName="overflow-x-auto">
				<Table className="min-w-[520px]">
					<TableCaption>选择只保存在展览页的本地状态中。</TableCaption>
					<TableHeader>
						<TableRow>
							<TableHead className="w-12">选择</TableHead>
							<TableHead>组件</TableHead>
							<TableHead>分类</TableHead>
							<TableHead className="text-right">状态</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{INITIAL_ROWS.map((name) => {
							const checked = selected.includes(name)
							return (
								<TableRow key={name} data-state={checked ? 'selected' : undefined}>
									<TableCell>
										<Checkbox
											checked={checked}
											onCheckedChange={(value) => toggleRow(name, value === true)}
											aria-label={`选择 ${name}`}
										/>
									</TableCell>
									<TableCell className="font-medium">{name}</TableCell>
									<TableCell>纯 UI</TableCell>
									<TableCell className="text-right">可复用</TableCell>
								</TableRow>
							)
						})}
					</TableBody>
				</Table>
			</StyleExhibit>

			<StyleExhibit title="ChatBubble 对话气泡" source="ui/chat-bubble.tsx">
				<div className="space-y-3">
					<ChatBubble from="bot">你好，这里只陈列内容样式，不连接聊天服务。</ChatBubble>
					<ChatBubble from="user">了解，气泡的方向和外观仍由组件自身负责。</ChatBubble>
				</div>
			</StyleExhibit>

			<div className="grid gap-4 lg:grid-cols-2">
				<StyleExhibit title="AutoHeight 高度过渡" source="ui/motion.tsx">
					<AutoHeight>
						<div className="rounded-control border border-dashed border-border p-4 text-sm leading-relaxed">
							<p>容器会在内容高度变化时平滑过渡。</p>
							{expanded && (
								<p className="mt-3 text-muted-foreground">
									这段额外内容模拟异步详情展开。动画结束后恢复自动高度，不会裁切内部浮层。
								</p>
							)}
						</div>
					</AutoHeight>
					<Button
						className="mt-4"
						variant="outline"
						size="sm"
						onClick={() => setExpanded((v) => !v)}
					>
						{expanded ? '收起内容' : '展开内容'}
					</Button>
				</StyleExhibit>

				<StyleExhibit title="FLIP 列表重排" source="ui/motion.tsx">
					<ul ref={listRef} className="space-y-2">
						{rows.map((name, index) => (
							<li
								key={name}
								data-flip-key={name}
								className="flex items-center justify-between gap-3 rounded-control border border-border/70 bg-card/60 px-3 py-2"
							>
								<span className="text-sm font-medium">{name}</span>
								<div className="flex gap-1">
									<Button
										variant="ghost"
										size="icon-sm"
										disabled={index === 0}
										onClick={() => move(index, -1)}
										aria-label={`上移 ${name}`}
									>
										<ArrowUp className="h-4 w-4" />
									</Button>
									<Button
										variant="ghost"
										size="icon-sm"
										disabled={index === rows.length - 1}
										onClick={() => move(index, 1)}
										aria-label={`下移 ${name}`}
									>
										<ArrowDown className="h-4 w-4" />
									</Button>
								</div>
							</li>
						))}
					</ul>
				</StyleExhibit>
			</div>
		</StyleSection>
	)
}
