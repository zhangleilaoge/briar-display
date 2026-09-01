'use client'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Link2, Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

interface ToolMediaSearchBarProps {
	input: string
	parsing: boolean
	hasResult: boolean
	onInputChange: (value: string) => void
	onParse: () => void
	onClear: () => void
}

export default function ToolMediaSearchBar({
	input,
	parsing,
	hasResult,
	onInputChange,
	onParse,
	onClear,
}: ToolMediaSearchBarProps) {
	return (
		<div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Link2 className="h-5 w-5 text-muted-foreground" />
					<h1 className="text-lg font-semibold">媒体解析</h1>
					<span className="text-sm text-muted-foreground">
						小红书无水印提取（视频 / 封面 / 图集）
					</span>
				</div>
				{hasResult && (
					<Button variant="outline" size="sm" onClick={onClear}>
						<RotateCcw className="mr-1.5 h-4 w-4" />
						清空
					</Button>
				)}
			</div>
			<Textarea
				value={input}
				onChange={(e) => onInputChange(e.target.value)}
				placeholder="粘贴小红书链接，或整段分享文案（含 xhslink.com 短链）…"
				className="min-h-20 resize-y"
				onKeyDown={(e) => {
					if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
						e.preventDefault()
						if (!input.trim()) {
							toast.error('请先粘贴链接')
							return
						}
						onParse()
					}
				}}
			/>
			<div className="flex items-center justify-between">
				<span className="text-xs text-muted-foreground">支持 ⌘/Ctrl + Enter 快速解析</span>
				<Button onClick={onParse} disabled={parsing || !input.trim()}>
					{parsing && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
					{parsing ? '解析中…' : '开始解析'}
				</Button>
			</div>
		</div>
	)
}
