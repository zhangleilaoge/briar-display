'use client'

import { type UserMergeLog, getUserMergeLogs } from '@/api/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, Loader2, RefreshCw } from 'lucide-react'
import { Fragment, useCallback, useEffect, useState } from 'react'
import AdminPagination from './AdminPagination'
import { RUN_STATUS_STYLE, formatRunDuration, formatRunTime } from './RunHistoryDialog'

const PAGE_SIZE = 20

const FILTERS: { value: 'all' | 'success' | 'failed'; label: string }[] = [
	{ value: 'all', label: '全部' },
	{ value: 'success', label: '成功' },
	{ value: 'failed', label: '失败' },
]

const who = (name: string, email: string) =>
	name ? `${name}${email ? `（${email}）` : ''}` : email || '-'

/** 单条合并记录的展开详情：各模块迁移数量 + 冲突 + 失败原因（个人中心复用） */
export function MergeLogDetail({ log }: { log: UserMergeLog }) {
	const moved = log.modules.filter((m) => m.moved > 0 || m.notes.length > 0)
	return (
		<div className="space-y-2 text-xs" data-testid="merge-log-detail">
			{log.error && (
				<pre className="whitespace-pre-wrap break-all rounded border border-danger/30 bg-danger-soft p-2 font-mono text-[11px] text-danger">
					{log.error}
				</pre>
			)}
			{log.conflicts.length > 0 && (
				<div className="space-y-0.5">
					{log.conflicts.map((c) => (
						<p key={`${c.module}-${c.message}`} className="text-warning">
							⚠ {c.label}：{c.message}
						</p>
					))}
				</div>
			)}
			{moved.length > 0 ? (
				<table className="w-full">
					<tbody className="divide-y divide-border/50">
						{moved.map((m) => (
							<tr key={m.name}>
								<td className="whitespace-nowrap py-1 pr-3">{m.label}</td>
								<td className="py-1 pr-3 text-right font-mono tabular-nums">{m.moved}</td>
								<td className="py-1 text-muted-foreground">{m.notes.join('；')}</td>
							</tr>
						))}
					</tbody>
				</table>
			) : (
				!log.error && <p className="text-muted-foreground">没有迁移任何数据</p>
			)}
		</div>
	)
}

export const mergeLogDuration = (log: UserMergeLog) =>
	formatRunDuration(new Date(log.finishedAt).getTime() - new Date(log.startedAt).getTime())

interface Props {
	open: boolean
	onOpenChange: (open: boolean) => void
}

/** 「合并记录」：所有用户合并（成功/失败）落库记录，样式与运行历史弹窗一致，行可展开看各模块明细 */
export default function MergeLogsDialog({ open, onOpenChange }: Props) {
	const [data, setData] = useState<{ items: UserMergeLog[]; total: number } | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [offset, setOffset] = useState(0)
	const [status, setStatus] = useState<'all' | 'success' | 'failed'>('all')
	const [expandedId, setExpandedId] = useState<string | null>(null)

	const load = useCallback(async () => {
		setLoading(true)
		setError(null)
		try {
			const res = await getUserMergeLogs({
				limit: PAGE_SIZE,
				offset,
				status: status === 'all' ? undefined : status,
			})
			if (res.success && res.data) setData(res.data)
			else setError(res.message || '加载失败')
		} catch (e) {
			const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
			setError(msg || '加载失败')
		} finally {
			setLoading(false)
		}
	}, [offset, status])

	useEffect(() => {
		if (open) void load()
	}, [open, load])

	useEffect(() => {
		if (!open) {
			setOffset(0)
			setStatus('all')
			setExpandedId(null)
		}
	}, [open])

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="flex max-h-[85vh] max-w-4xl flex-col gap-3 overflow-hidden"
				data-testid="merge-logs-dialog"
			>
				<div className="flex items-start justify-between gap-2 pr-6">
					<div>
						<DialogTitle className="text-base">合并记录</DialogTitle>
						<DialogDescription className="text-xs">
							每次用户合并（含失败）都会落库；源用户合并后已删除，名字与邮箱为当时快照
						</DialogDescription>
					</div>
					<Button
						size="sm"
						variant="ghost"
						onClick={() => void load()}
						disabled={loading}
						className="h-7 gap-1 text-xs"
					>
						<RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
						刷新
					</Button>
				</div>

				<div className="flex flex-wrap gap-1">
					{FILTERS.map((f) => (
						<Button
							key={f.value}
							size="sm"
							variant={status === f.value ? 'secondary' : 'ghost'}
							className="h-7 px-2.5 text-xs"
							onClick={() => {
								setStatus(f.value)
								setOffset(0)
							}}
						>
							{f.label}
						</Button>
					))}
				</div>

				<div className="min-h-0 flex-1 overflow-auto rounded-md border">
					{loading && !data ? (
						<div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
							<Loader2 className="h-4 w-4 animate-spin" />
							加载中...
						</div>
					) : error ? (
						<p className="py-10 text-center text-xs text-danger">{error}</p>
					) : !data || data.items.length === 0 ? (
						<p className="py-10 text-center text-xs text-muted-foreground">暂无合并记录</p>
					) : (
						<table className="w-full text-sm">
							<thead className="sticky top-0 bg-muted/90">
								<tr className="border-b">
									<th className="w-6" />
									<th className="px-3 py-2 text-left font-medium text-muted-foreground">时间</th>
									<th className="px-3 py-2 text-left font-medium text-muted-foreground">
										源用户（已删除）
									</th>
									<th className="px-3 py-2 text-left font-medium text-muted-foreground">
										并入目标
									</th>
									<th className="px-3 py-2 text-left font-medium text-muted-foreground">执行人</th>
									<th className="px-3 py-2 text-left font-medium text-muted-foreground">状态</th>
									<th className="px-3 py-2 text-right font-medium text-muted-foreground">耗时</th>
								</tr>
							</thead>
							<tbody className="divide-y">
								{data.items.map((log) => {
									const style = RUN_STATUS_STYLE[log.status]
									const expanded = expandedId === log.id
									return (
										<Fragment key={log.id}>
											<tr
												className="cursor-pointer hover:bg-muted/40"
												onClick={() => setExpandedId(expanded ? null : log.id)}
											>
												<td className="pl-2 text-muted-foreground">
													{expanded ? (
														<ChevronDown className="h-3.5 w-3.5" />
													) : (
														<ChevronRight className="h-3.5 w-3.5" />
													)}
												</td>
												<td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
													{formatRunTime(log.startedAt)}
												</td>
												<td className="max-w-[200px] truncate px-3 py-2 text-xs">
													{who(log.sourceName, log.sourceEmail)}
												</td>
												<td className="max-w-[200px] truncate px-3 py-2 text-xs">
													{who(log.targetName, log.targetEmail)}
												</td>
												<td className="max-w-[120px] truncate px-3 py-2 text-xs text-muted-foreground">
													{log.operatorName || '-'}
												</td>
												<td className="px-3 py-2">
													<Badge variant="secondary" className={`text-[11px] ${style.className}`}>
														{style.label}
													</Badge>
													{log.conflicts.length > 0 && (
														<span className="ml-1 text-[11px] text-warning">
															{log.conflicts.length} 冲突
														</span>
													)}
												</td>
												<td className="whitespace-nowrap px-3 py-2 text-right font-mono text-xs">
													{mergeLogDuration(log)}
												</td>
											</tr>
											{expanded && (
												<tr className="bg-muted/30">
													<td />
													<td colSpan={6} className="px-3 py-2">
														<MergeLogDetail log={log} />
													</td>
												</tr>
											)}
										</Fragment>
									)
								})}
							</tbody>
						</table>
					)}
				</div>

				{data && data.total > PAGE_SIZE && (
					<AdminPagination
						total={data.total}
						limit={PAGE_SIZE}
						offset={offset}
						onPageChange={setOffset}
					/>
				)}
			</DialogContent>
		</Dialog>
	)
}
