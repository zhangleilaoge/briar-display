'use client'

import { Button } from '@/components/ui/button'
import { History, Trash2, X } from 'lucide-react'
import {
	type MediaHistoryItem,
	platformFromUrl,
	platformIcon,
	platformLabel,
} from './toolMediaUtils'

interface ToolMediaHistoryProps {
	items: MediaHistoryItem[]
	onSelect: (url: string) => void
	onRemove: (url: string) => void
	onClear: () => void
}

/** 解析历史（最近 10 条）：点击重新解析，可单条移除或清空 */
export default function ToolMediaHistory({
	items,
	onSelect,
	onRemove,
	onClear,
}: ToolMediaHistoryProps) {
	if (items.length === 0) return null

	return (
		<div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 text-sm font-medium">
					<History className="h-4 w-4 text-muted-foreground" />
					历史记录
					<span className="text-xs text-muted-foreground">最近 {items.length} 条</span>
				</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={onClear}
					className="h-auto p-1 text-xs text-muted-foreground hover:text-destructive"
				>
					<Trash2 className="h-3.5 w-3.5" />
				</Button>
			</div>
			<ul className="flex flex-col divide-y">
				{items.map((item) => {
					const platform = platformFromUrl(item.url)
					return (
						<li key={item.url} className="group flex items-center gap-2 py-2">
							<button
								type="button"
								className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
								onClick={() => onSelect(item.url)}
								title="重新解析该链接"
							>
								<span className="flex w-full items-center gap-1.5">
									<span className="truncate text-sm">{item.title || '（无标题）'}</span>
									{platformIcon(platform) && (
										<span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
											<img
												src={platformIcon(platform)}
												alt=""
												className="h-3.5 w-3.5 rounded-[3px]"
											/>
											{platformLabel(platform)}
										</span>
									)}
								</span>
								<span className="w-full truncate text-xs text-muted-foreground">{item.url}</span>
							</button>
							<Button
								variant="ghost"
								size="sm"
								aria-label="移除该条历史"
								className="h-auto p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
								onClick={() => onRemove(item.url)}
							>
								<X className="h-3.5 w-3.5" />
							</Button>
						</li>
					)
				})}
			</ul>
		</div>
	)
}
