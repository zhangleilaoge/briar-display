import { Button } from '@/components/ui/button'
import { Clock, Trash2 } from 'lucide-react'
import type { HistoryEntry } from './toolJsonUtils'
import { formatFullTime, formatRelativeTime, formatSize } from './toolJsonUtils'

interface JsonHistoryPanelProps {
	entries: HistoryEntry[]
	onRestore: (entry: HistoryEntry) => void
	onDelete: (id: string) => void
	onClear: () => void
	now: number
}

/** 历史记录底部玻璃面板（首屏外，移动端友好） */
export default function JsonHistoryPanel({
	entries,
	onRestore,
	onDelete,
	onClear,
	now,
}: JsonHistoryPanelProps) {
	return (
		<div className="glass shrink-0 rounded-xl">
			<div className="flex items-center justify-between border-b px-3 py-2">
				<span className="text-sm font-medium">
					历史记录
					{entries.length > 0 && (
						<span className="ml-1.5 text-xs font-normal text-muted-foreground">
							({entries.length})
						</span>
					)}
				</span>
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
			</div>
			<div className="max-h-52 overflow-y-auto p-2">
				{entries.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-6 text-xs text-muted-foreground">
						<Clock className="mb-2 h-6 w-6 opacity-40" />
						暂无历史记录
					</div>
				) : (
					<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
						{entries.map((entry) => (
							<div
								key={entry.id}
								onClick={() => onRestore(entry)}
								className="group flex cursor-pointer flex-col rounded-md border border-border/70 bg-card/75 px-3 py-2.5 text-left transition-colors hover:bg-card"
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
														? 'rounded bg-danger-soft px-1.5 py-0.5 text-[10px] text-danger'
														: tag === '对象'
															? 'rounded bg-warning-soft px-1.5 py-0.5 text-[10px] text-warning'
															: tag === 'JSON'
																? 'rounded bg-info-soft px-1.5 py-0.5 text-[10px] text-info'
																: 'rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground'
												}
											>
												{tag}
											</span>
										))}
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
