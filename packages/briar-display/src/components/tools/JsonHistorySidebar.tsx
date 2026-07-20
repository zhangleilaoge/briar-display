import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Clock, Trash2 } from 'lucide-react'
import type { HistoryEntry } from './toolJsonUtils'
import { formatFullTime, formatRelativeTime, formatSize } from './toolJsonUtils'

interface JsonHistorySidebarProps {
	collapsed: boolean
	onToggle: () => void
	entries: HistoryEntry[]
	onRestore: (entry: HistoryEntry) => void
	onDelete: (id: string) => void
	onClear: () => void
	now: number
}

export default function JsonHistorySidebar({
	collapsed,
	onToggle,
	entries,
	onRestore,
	onDelete,
	onClear,
	now,
}: JsonHistorySidebarProps) {
	if (collapsed) {
		return (
			<div className="flex w-8 shrink-0 flex-col items-center rounded-md border bg-muted/20">
				<button
					onClick={onToggle}
					className="mt-2 flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					title="展开历史记录"
				>
					<ChevronRight className="h-4 w-4" />
				</button>
				{entries.length > 0 && (
					<span className="mt-1 text-[10px] font-medium text-muted-foreground">
						{entries.length}
					</span>
				)}
			</div>
		)
	}

	return (
		<div className="flex w-[220px] shrink-0 flex-col rounded-md border bg-muted/20">
			<div className="flex items-center justify-between border-b px-3 py-2">
				<span className="text-sm font-medium">历史记录</span>
				<div className="flex items-center gap-1">
					{entries.length > 0 && (
						<Button
							variant="ghost"
							size="sm"
							onClick={onClear}
							className="h-auto p-1 text-xs text-muted-foreground hover:text-destructive"
						>
							<Trash2 className="h-3.5 w-3.5" />
						</Button>
					)}
					<Button
						variant="ghost"
						size="sm"
						onClick={onToggle}
						className="h-auto p-1 text-muted-foreground hover:text-foreground"
						title="收起历史记录"
					>
						<ChevronLeft className="h-4 w-4" />
					</Button>
				</div>
			</div>
			<div className="flex-1 overflow-y-auto">
				{entries.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-8 text-xs text-muted-foreground">
						<Clock className="mb-2 h-6 w-6 opacity-40" />
						暂无历史记录
					</div>
				) : (
					entries.map((entry) => (
						<div
							key={entry.id}
							onClick={() => onRestore(entry)}
							className="group flex w-full flex-col border-b px-3 py-2.5 text-left transition-colors hover:bg-accent"
						>
							<div className="flex items-center justify-between">
								<span className="text-xs font-medium text-foreground">
									{formatRelativeTime(entry.timestamp, now)}
								</span>
								<Button
									variant="ghost"
									size="sm"
									onClick={(e) => {
										e.stopPropagation()
										onDelete(entry.id)
									}}
									className="h-auto p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
								>
									<Trash2 className="h-3 w-3" />
								</Button>
							</div>
							<span className="mt-0.5 text-[11px] text-muted-foreground">
								{formatFullTime(entry.timestamp)} · {formatSize(entry.input)}
							</span>
							{(entry.tags ?? []).length > 0 && (
								<div className="mt-1 flex flex-wrap gap-1">
									{(entry.tags ?? []).map((tag) => (
										<span
											key={tag}
											className={
												tag === '非法'
													? 'rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700'
													: tag === '对象'
														? 'rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700'
														: tag === 'JSON'
															? 'rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700'
															: 'rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600'
											}
										>
											{tag}
										</span>
									))}
								</div>
							)}
						</div>
					))
				)}
			</div>
		</div>
	)
}
