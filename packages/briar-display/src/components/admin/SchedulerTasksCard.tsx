'use client'

import { getSchedulerTasks, runSchedulerTask } from '@/api/deploy'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { SchedulerRunStatus, SchedulerTaskInfo } from '@briar/shared'
import { CalendarClock, Loader2, Play } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

const STATUS_STYLE: Record<SchedulerRunStatus, { label: string; className: string }> = {
	running: { label: '运行中', className: 'animate-pulse bg-blue-100 text-blue-700' },
	success: { label: '成功', className: 'bg-green-100 text-green-700' },
	failed: { label: '失败', className: 'bg-red-100 text-red-700' },
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
	const wasRunningRef = useRef(false)

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
				if (task.lastRun.status === 'success') {
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
				<div className="divide-y rounded-md border">
					{tasks.map((task) => {
						const lastRun = task.lastRun
						const running = lastRun?.status === 'running'
						const busy = triggering === task.name || running
						const duration = lastRun ? formatDuration(lastRun.startedAt, lastRun.finishedAt) : null

						return (
							<div key={task.name} className="flex items-start justify-between gap-3 px-3 py-3">
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
						)
					})}
				</div>
			)}
		</div>
	)
}
