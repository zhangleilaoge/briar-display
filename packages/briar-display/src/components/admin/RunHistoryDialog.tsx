'use client'

import type { RunHistoryQuery } from '@/api/deploy'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { ApiResponse, RunHistoryPage, RunRecord, RunRecordStatus } from '@briar/shared'
import { ChevronDown, ChevronRight, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { Fragment, useCallback, useEffect, useState } from 'react'
import AdminPagination from './AdminPagination'

const PAGE_SIZE = 20

export const RUN_STATUS_STYLE: Record<
	RunRecordStatus,
	{ label: string; className: string; bar: string }
> = {
	running: {
		label: '运行中',
		className: 'animate-pulse bg-info-soft text-info',
		bar: 'bg-info',
	},
	success: { label: '成功', className: 'bg-success-soft text-success', bar: 'bg-success' },
	skipped: {
		label: '跳过',
		className: 'bg-muted text-muted-foreground',
		bar: 'bg-muted-foreground/40',
	},
	failed: { label: '失败', className: 'bg-danger-soft text-danger', bar: 'bg-danger' },
}

const TRIGGER_LABEL: Record<string, string> = {
	scheduled: '定时',
	manual: '手动',
	push: 'CI 推送',
}

const FILTERS: { value: RunRecordStatus | 'all'; label: string }[] = [
	{ value: 'all', label: '全部' },
	{ value: 'success', label: '成功' },
	{ value: 'failed', label: '失败' },
	{ value: 'skipped', label: '跳过' },
	{ value: 'running', label: '运行中' },
]

export function formatRunTime(date: string) {
	return new Date(date).toLocaleString('zh-CN', { hour12: false })
}

export function formatRunDuration(ms: number | null): string {
	if (ms === null) return '-'
	if (ms < 1000) return `${ms}ms`
	const seconds = Math.round(ms / 1000)
	return seconds >= 60 ? `${Math.floor(seconds / 60)}m${seconds % 60}s` : `${seconds}s`
}

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

/** 展开行：失败原因（job/step + 报错片段）与 GitHub 运行链接优先展示，其余字段仍给原始 JSON */
function RunDetail({ detail }: { detail: Record<string, unknown> }) {
	const runUrl = str(detail.runUrl)
	const failedJob = str(detail.failedJob)
	const failedStep = str(detail.failedStep)
	const errorExcerpt = str(detail.errorExcerpt)
	const { runUrl: _u, failedJob: _j, failedStep: _s, errorExcerpt: _e, ...rest } = detail
	return (
		<div className="space-y-2" data-testid="run-detail">
			{(failedJob || failedStep) && (
				<div className="text-xs">
					<span className="font-medium text-danger">失败位置：</span>
					<span className="font-mono">
						{failedJob ?? '-'}
						{failedStep && ` › ${failedStep}`}
					</span>
				</div>
			)}
			{errorExcerpt && (
				<pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all rounded border border-danger/30 bg-danger-soft p-2 font-mono text-[11px] text-danger">
					{errorExcerpt}
				</pre>
			)}
			{runUrl && (
				<a
					href={runUrl}
					target="_blank"
					rel="noreferrer"
					className="inline-flex items-center gap-1 text-xs text-info hover:underline"
					onClick={(e) => e.stopPropagation()}
				>
					<ExternalLink className="h-3 w-3" />在 GitHub Actions 查看本次运行
				</a>
			)}
			{Object.keys(rest).length > 0 && (
				<pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-muted-foreground">
					{JSON.stringify(rest, null, 2)}
				</pre>
			)}
		</div>
	)
}

interface RunHistoryDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	title: string
	description?: string
	/** 拉取一页历史（定时任务 / 证书 / 部署 共用） */
	fetcher: (q: RunHistoryQuery) => Promise<ApiResponse<RunHistoryPage>>
	/** 可选：额外列（如部署的 commit） */
	renderExtra?: (record: RunRecord) => React.ReactNode
}

/**
 * 通用运行历史弹窗：近期成功率条 + 状态筛选 + 分页表格（时间/触发/状态/耗时/信息）+ 可展开 detail JSON
 */
export default function RunHistoryDialog({
	open,
	onOpenChange,
	title,
	description,
	fetcher,
	renderExtra,
}: RunHistoryDialogProps) {
	const [data, setData] = useState<RunHistoryPage | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [offset, setOffset] = useState(0)
	const [status, setStatus] = useState<RunRecordStatus | 'all'>('all')
	const [expandedId, setExpandedId] = useState<string | null>(null)

	const load = useCallback(async () => {
		setLoading(true)
		setError(null)
		try {
			const res = await fetcher({
				limit: PAGE_SIZE,
				offset,
				status: status === 'all' ? undefined : status,
			})
			if (res.success && res.data) setData(res.data)
			else setError(res.message || '加载失败')
		} catch (e) {
			setError(e instanceof Error ? e.message : '加载失败')
		} finally {
			setLoading(false)
		}
	}, [fetcher, offset, status])

	useEffect(() => {
		if (open) void load()
	}, [open, load])

	// 关闭时重置筛选
	useEffect(() => {
		if (!open) {
			setOffset(0)
			setStatus('all')
			setExpandedId(null)
		}
	}, [open])

	const stats = data?.stats
	const finished = stats ? stats.success + stats.failed : 0
	const successRate = stats && finished > 0 ? Math.round((stats.success / finished) * 100) : null

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-3 overflow-hidden">
				<DialogHeader className="shrink-0">
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription className="text-xs text-white/75">
						{description ?? '所有运行记录均已落库，保留 180 天'}
					</DialogDescription>
				</DialogHeader>

				{/* 上面这块（刷新 + 近期条/热力 + 状态 Tab）禁止压缩，只让下面表格区滚动 */}
				<div
					data-rv-dialog-fixed=""
					className="flex shrink-0 flex-col gap-3"
					style={{ flexShrink: 0, minHeight: 'fit-content' }}
				>
					<div className="flex justify-end">
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

					{stats && stats.total > 0 && (
						<div className="space-y-1 rounded-md border bg-muted/30 p-2">
							<div className="flex items-center justify-between text-xs text-muted-foreground">
								<span>最近 {stats.total} 次</span>
								<span>
									成功率 {successRate === null ? '-' : `${successRate}%`} · 成功 {stats.success} ·
									失败 {stats.failed}
									{stats.skipped > 0 && ` · 跳过 ${stats.skipped}`}
								</span>
							</div>
							<div className="flex h-3 gap-0.5">
								{[...stats.recent].reverse().map((s, i) => (
									<div
										key={i}
										className={cn('flex-1 rounded-sm', RUN_STATUS_STYLE[s].bar)}
										title={RUN_STATUS_STYLE[s].label}
									/>
								))}
							</div>
						</div>
					)}

					<div className="flex flex-wrap gap-1">
						{FILTERS.map((f) => (
							<Button
								key={f.value}
								size="sm"
								variant={status === f.value ? 'default' : 'ghost'}
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
						<p className="py-10 text-center text-xs text-muted-foreground">暂无记录</p>
					) : (
						<table className="w-full text-sm">
							<thead className="sticky top-0 bg-muted/90">
								<tr className="border-b">
									<th className="w-6" />
									<th className="px-3 py-2 text-left font-medium text-muted-foreground">时间</th>
									<th className="px-3 py-2 text-left font-medium text-muted-foreground">触发</th>
									<th className="px-3 py-2 text-left font-medium text-muted-foreground">状态</th>
									<th className="px-3 py-2 text-right font-medium text-muted-foreground">耗时</th>
									<th className="px-3 py-2 text-left font-medium text-muted-foreground">信息</th>
								</tr>
							</thead>
							<tbody className="divide-y">
								{data.items.map((item) => {
									const style = RUN_STATUS_STYLE[item.status]
									const expanded = expandedId === item.id
									const hasDetail = !!item.detail && Object.keys(item.detail).length > 0
									return (
										<Fragment key={item.id}>
											<tr
												className={cn(hasDetail && 'cursor-pointer hover:bg-muted/40')}
												onClick={() => hasDetail && setExpandedId(expanded ? null : item.id)}
											>
												<td className="pl-2 text-muted-foreground">
													{hasDetail &&
														(expanded ? (
															<ChevronDown className="h-3.5 w-3.5" />
														) : (
															<ChevronRight className="h-3.5 w-3.5" />
														))}
												</td>
												<td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
													{formatRunTime(item.startedAt)}
												</td>
												<td className="whitespace-nowrap px-3 py-2 text-xs">
													{TRIGGER_LABEL[item.trigger] ?? item.trigger}
												</td>
												<td className="px-3 py-2">
													<Badge variant="secondary" className={`text-[11px] ${style.className}`}>
														{style.label}
													</Badge>
												</td>
												<td className="whitespace-nowrap px-3 py-2 text-right font-mono text-xs">
													{formatRunDuration(item.durationMs)}
												</td>
												<td
													className="max-w-[320px] truncate px-3 py-2 text-xs text-muted-foreground"
													title={item.message || ''}
												>
													{renderExtra?.(item)}
													{item.message || '-'}
												</td>
											</tr>
											{expanded && hasDetail && (
												<tr className="bg-muted/30">
													<td />
													<td colSpan={5} className="px-3 py-2">
														<RunDetail detail={item.detail as Record<string, unknown>} />
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
					<div data-rv-dialog-fixed="" className="shrink-0" style={{ flexShrink: 0 }}>
						<AdminPagination
							total={data.total}
							limit={PAGE_SIZE}
							offset={offset}
							onPageChange={setOffset}
						/>
					</div>
				)}
			</DialogContent>
		</Dialog>
	)
}
