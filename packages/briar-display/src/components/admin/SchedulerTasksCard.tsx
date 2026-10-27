'use client'

import { getSchedulerTaskRuns, getSchedulerTasks, runSchedulerTask } from '@/api/deploy'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { SchedulerRunStatus, SchedulerTaskInfo } from '@briar/shared'
import { CalendarClock, ChevronDown, ChevronUp, History, Loader2, Play } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import RunHistoryDialog from './RunHistoryDialog'

/** 默认展示条数，超出后折叠为「加载更多」 */
const COLLAPSED_COUNT = 3

const STATUS_STYLE: Record<SchedulerRunStatus, { label: string; className: string }> = {
	running: { label: '运行中', className: 'animate-pulse bg-info-soft text-info' },
	success: { label: '成功', className: 'bg-success-soft text-success' },
	skipped: { label: '跳过', className: 'bg-muted text-muted-foreground' },
	failed: { label: '失败', className: 'bg-danger-soft text-danger' },
}

function formatTime(date: string) {
	return new Date(date).toLocaleString('zh-CN', { hour12: false })
}

function formatDuration(startedAt: string, finishedAt: string | null): string | null {
	if (!finishedAt) return null
	const seconds = Math.round(
		(new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000,
	)
	return seconds >= 60 ? `${Math.floor(seconds / 60)}m${seconds % 60}s` : `${seconds}s`
}

export default function SchedulerTasksCard() {
	const [tasks, setTasks] = useState<SchedulerTaskInfo[]>([])
	const [loading, setLoading] = useState(true)
	const [triggering, setTriggering] = useState<string | null>(null)
	const [expanded, setExpanded] = useState(false)
	const wasRunningRef = useRef(false)
	const [historyTask, setHistoryTask] = useState<SchedulerTaskInfo | null>(null)
	const historyName = historyTask?.name
	const fetchHistory = useCallback(
		(q: Parameters<typeof getSchedulerTaskRuns>[1]) => getSchedulerTaskRuns(historyName ?? '', q),
		[historyName],
	)

	const fetchTasks = useCallback(async () => {
		const res = await getSchedulerTasks()
		if (res.success && res.data) setTasks(res.data.items)
	}, [])

	useEffect(() => {
		fetchTasks().finally(() => setLoading(false))
	}, [fetchTasks])

	// 有运行中的任务时轮询，全部结束后提示结果
	const hasRunning = tasks.some((t) => t.lastRun?.status === 'running')
	useEffect(() => {
		if (!hasRunning) return
		const timer = setInterval(fetchTasks, 3000)
		return () => clearInterval(timer)
	}, [hasRunning, fetchTasks])

	useEffect(() => {
		if (wasRunningRef.current && !hasRunning) {
			for (const task of tasks) {
				if (!task.lastRun || task.lastRun.status === 'running') continue
				if (task.lastRun.status === 'success' || task.lastRun.status === 'skipped') {
					toast.success(
						`${task.label}执行成功${task.lastRun.message ? `：${task.lastRun.message}` : ''}`,
					)
				} else {
					toast.error(`${task.label}执行失败：${task.lastRun.message || '未知错误'}`)
				}
			}
		}
		wasRunningRef.current = hasRunning
	}, [hasRunning, tasks])

	const handleRun = async (task: SchedulerTaskInfo) => {
		setTriggering(task.name)
		try {
			const res = await runSchedulerTask(task.name)
			if (res.success) {
				toast.success(`${task.label}已启动`)
				setTimeout(fetchTasks, 1000)
			} else {
				toast.error(res.message || '触发失败')
			}
		} catch {
			toast.error('触发失败')
		} finally {
			setTriggering(null)
		}
	}

	return (
		<div className="mb-4 rounded-md border bg-card p-4">
			<div className="mb-3 flex items-center gap-2">
				<CalendarClock className="h-4 w-4 text-muted-foreground" />
				<h2 className="text-sm font-semibold">定时任务</h2>
			</div>

			{loading ? (
				<div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
					<Loader2 className="h-4 w-4 animate-spin" />
					加载中...
				</div>
			) : tasks.length === 0 ? (
				<p className="py-8 text-center text-xs text-muted-foreground">暂无定时任务</p>
			) : (
				<>
					<div className="divide-y rounded-md border">
						{(expanded ? tasks : tasks.slice(0, COLLAPSED_COUNT)).map((task) => {
							const lastRun = task.lastRun
							const running = lastRun?.status === 'running'
							const busy = triggering === task.name || running
							const duration = lastRun
								? formatDuration(lastRun.startedAt, lastRun.finishedAt)
								: null

							return (
								<div
									key={task.name}
									className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
								>
									<div className="min-w-0 flex-1 space-y-1">
										<div className="flex flex-wrap items-center gap-2">
											<span className="text-sm font-medium">{task.label}</span>
											<Badge variant="outline" className="text-[11px] font-normal">
												{task.scheduleText}
											</Badge>
										</div>
										<p className="text-xs text-muted-foreground">{task.description}</p>
										<p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
											{lastRun ? (
												<>
													<span>上次运行 {formatTime(lastRun.startedAt)}</span>
													<span>·</span>
													<Badge
														variant="secondary"
														className={`text-[11px] ${STATUS_STYLE[lastRun.status].className}`}
													>
														{STATUS_STYLE[lastRun.status].label}
													</Badge>
													{duration && (
														<>
															<span>·</span>
															<span className="font-mono">{duration}</span>
														</>
													)}
													{lastRun.message && (
														<>
															<span>·</span>
															<span className="truncate" title={lastRun.message}>
																{lastRun.message}
															</span>
														</>
													)}
												</>
											) : (
												'尚未运行'
											)}
										</p>
									</div>
									<div className="flex shrink-0 items-center justify-end gap-1.5">
										<Button
											size="sm"
											variant="ghost"
											onClick={() => setHistoryTask(task)}
											className="gap-1.5 text-muted-foreground"
										>
											<History className="h-3.5 w-3.5" />
											历史记录
										</Button>
										{task.manual && (
											<Button
												size="sm"
												variant="outline"
												onClick={() => handleRun(task)}
												disabled={busy}
												className="shrink-0 gap-1.5"
											>
												{busy ? (
													<Loader2 className="h-3.5 w-3.5 animate-spin" />
												) : (
													<Play className="h-3.5 w-3.5" />
												)}
												{running ? '执行中...' : '立即执行'}
											</Button>
										)}
									</div>
								</div>
							)
						})}
					</div>
					{tasks.length > COLLAPSED_COUNT && (
						<Button
							variant="ghost"
							size="sm"
							className="mt-2 w-full gap-1 text-xs text-muted-foreground"
							onClick={() => setExpanded((v) => !v)}
						>
							{expanded ? (
								<>
									<ChevronUp className="h-3.5 w-3.5" />
									收起
								</>
							) : (
								<>
									<ChevronDown className="h-3.5 w-3.5" />
									加载更多（还有 {tasks.length - COLLAPSED_COUNT} 条）
								</>
							)}
						</Button>
					)}
				</>
			)}
			<RunHistoryDialog
				open={!!historyTask}
				onOpenChange={(open) => !open && setHistoryTask(null)}
				title={`${historyTask?.label ?? ''} · 运行历史`}
				description={historyTask?.description}
				fetcher={fetchHistory}
			/>
		</div>
	)
}
