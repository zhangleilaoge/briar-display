'use client'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Link2, Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { platformIcon } from './toolMediaUtils'

/** 支持的平台（纯图标示意） */
const SUPPORTED_PLATFORMS = ['xiaohongshu', 'douyin', 'wechat', 'x', 'bilibili']

interface ToolMediaSearchBarProps {
	input: string
	parsing: boolean
	/** 解析超过 8s：上游首解析偶发极慢，提示用户不是卡死 */
	slowHint: boolean
	hasResult: boolean
	onInputChange: (value: string) => void
	onParse: () => void
	onClear: () => void
}

export default function ToolMediaSearchBar({
	input,
	parsing,
	slowHint,
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
					<span className="flex items-center gap-1.5 text-sm text-muted-foreground">
						{SUPPORTED_PLATFORMS.map((platform) => (
							<img
								key={platform}
								src={platformIcon(platform)}
								alt={platform}
								className="h-3.5 w-3.5 rounded-[3px]"
							/>
						))}
						无水印提取（视频 / 封面 / 图集 / 实况图）
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
				placeholder="粘贴分享链接，也支持整段分享文案…"
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
				<span className="text-xs text-muted-foreground">
					{slowHint && parsing
						? '该链接首次解析较慢（可能需 1 分钟左右），请耐心等待…'
						: '支持 ⌘/Ctrl + Enter 快速解析'}
				</span>
				<Button onClick={onParse} disabled={parsing || !input.trim()}>
					{parsing && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
					{parsing ? '解析中…' : '开始解析'}
				</Button>
			</div>
		</div>
	)
}
