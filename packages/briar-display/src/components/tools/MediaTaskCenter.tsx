'use client'

import { useNavigate } from '@/components/common/SectionRouter'
import { Button } from '@/components/ui/button'
import { useExitAnimation } from '@/components/ui/motion'
import { cn } from '@/lib/utils'
import {
	Check,
	CheckCircle2,
	ChevronDown,
	Download,
	FileCheck2,
	FolderPlus,
	Loader2,
	Package,
	RotateCcw,
	TriangleAlert,
	X,
} from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useMediaTasks } from './mediaTaskContext'
import { type MediaTask, type MediaTaskItem, getMediaTaskPercent } from './mediaTaskUtils'
import { formatMb } from './toolMediaUtils'

const TASK_ICONS = {
	download: Download,
	add: FolderPlus,
	zip: Package,
} as const

function TaskRing({ percent, status }: { percent: number; status: MediaTask['status'] | 'idle' }) {
	const radius = 18
	const circumference = 2 * Math.PI * radius
	return (
		<div className="relative h-10 w-10 shrink-0">
			<svg className="h-10 w-10 -rotate-90" viewBox="0 0 44 44" aria-hidden="true">
				<circle
					cx="22"
					cy="22"
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth="3"
					className="text-primary/25"
				/>
				<circle
					cx="22"
					cy="22"
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth="3"
					strokeLinecap="round"
					strokeDasharray={circumference}
					strokeDashoffset={circumference * (1 - percent / 100)}
					className={cn(
						'transition-[stroke-dashoffset] duration-300',
						status === 'error' ? 'text-destructive' : 'text-primary',
					)}
				/>
			</svg>
			<span className="absolute inset-0 flex items-center justify-center">
				{status === 'success' ? (
					<Check className="h-4 w-4 text-success" />
				) : status === 'error' ? (
					<TriangleAlert className="h-4 w-4 text-destructive" />
				) : status === 'idle' ? null : (
					<span className="text-[9px] font-semibold">{percent}%</span>
				)}
			</span>
		</div>
	)
}

function itemProgressText(task: MediaTask, item: MediaTaskItem) {
	if (item.status === 'pending') return '等待中'
	if (item.status === 'success') return task.kind === 'zip' ? '已下载' : '已完成'
	if (item.status === 'error') return item.error || '失败'
	const percent = item.progress.percent
	if (item.phase === 'upload') return `上传中 ${percent}%`
	if (item.progress.loaded !== undefined) {
		const loaded = `${formatMb(item.progress.loaded)}MB`
		const total = item.progress.total !== undefined ? ` / ${formatMb(item.progress.total)}MB` : ''
		return `下载中 ${percent}% · ${loaded}${total}`
	}
	return percent > 0 ? `下载中 ${percent}%` : '下载中…'
}

function TaskItemRow({
	task,
	item,
	isLast,
	onRetry,
}: {
	task: MediaTask
	item: MediaTaskItem
	isLast: boolean
	onRetry?: () => void
}) {
	const percent = item.status === 'success' ? 100 : item.progress.percent
	const progressText = itemProgressText(task, item)
	return (
		<div
			className={cn(
				'rv-media-task-item relative rounded-md bg-muted/30 px-2 py-1.5',
				'before:absolute before:-left-3 before:top-0 before:w-px before:bg-primary/20',
				'after:absolute after:-left-3 after:top-[15px] after:h-px after:w-2.5 after:bg-primary/20',
				isLast ? 'before:h-[15px]' : 'before:-bottom-1',
			)}
		>
			<div className="flex min-h-5 items-center gap-1.5">
				<span className="shrink-0 text-muted-foreground">
					{item.status === 'success' ? (
						<CheckCircle2 className="h-3.5 w-3.5 text-success" />
					) : item.status === 'error' ? (
						<TriangleAlert className="h-3.5 w-3.5 text-destructive" />
					) : item.status === 'running' ? (
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
					) : (
						<span className="block h-3.5 w-3.5 text-center text-[10px]">·</span>
					)}
				</span>
				<span
					className={cn('min-w-0 truncate text-xs', onRetry ? 'max-w-[35%]' : 'flex-1')}
					title={item.media.filename}
				>
					{item.media.label}
				</span>
				<span
					className={cn(
						'min-w-0 flex-1 truncate text-right text-[11px] text-muted-foreground',
						item.status === 'error' && 'text-destructive',
					)}
					title={progressText}
				>
					{progressText}
				</span>
				{onRetry && (
					<Button
						variant="ghost"
						size="sm"
						className="h-6 shrink-0 px-1.5 text-[11px]"
						onClick={onRetry}
					>
						<RotateCcw className="mr-1 h-3 w-3" />
						重试
					</Button>
				)}
			</div>
			{item.status === 'running' && (
				<div
					className="ml-5 mt-1 h-1 overflow-hidden rounded-full bg-primary/20"
					role="progressbar"
					tabIndex={0}
					aria-label={`${item.media.label}进度`}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={percent}
				>
					<div
						className="h-full rounded-full bg-primary transition-[width] duration-200"
						style={{ width: `${percent}%` }}
					/>
				</div>
			)}
		</div>
	)
}

function TaskCard({ task }: { task: MediaTask }) {
	const { retryTask, dismissTask } = useMediaTasks()
	const navigate = useNavigate()
	const dismiss = useCallback(() => dismissTask(task.id), [dismissTask, task.id])
	const { requestClose, state } = useExitAnimation(dismiss)
	const percent = getMediaTaskPercent(task)
	const Icon = TASK_ICONS[task.kind]
	const failed = task.items.filter((item) => item.status === 'error').length
	const hasItemError = failed > 0
	const groupRetry =
		task.status === 'error' && (task.items.length > 1 || !hasItemError)
			? () => retryTask(task.id)
			: undefined
	const statusText =
		task.status === 'running'
			? task.packing
				? '正在打包'
				: `${percent}%`
			: task.status === 'success'
				? '已完成'
				: hasItemError && failed < task.items.length
					? '部分完成'
					: '未完成'
	return (
		<section
			className="rv-media-task-card rv-motion-dialog rounded-lg border bg-card p-2.5 shadow-sm"
			data-media-task={task.id}
			data-state={state}
			aria-hidden={state === 'closed'}
		>
			<div className="flex items-center gap-2">
				<span className="rv-media-task-icon shrink-0 rounded-md bg-primary/10 p-1 text-primary">
					<Icon className="h-3.5 w-3.5" />
				</span>
				<h3 className="min-w-0 flex-1 truncate text-sm font-medium" title={task.title}>
					{task.title}
				</h3>
				<span className="shrink-0 text-[11px] text-muted-foreground">{task.items.length} 项</span>
				<span
					className={cn(
						'shrink-0 text-[11px] text-muted-foreground',
						task.status === 'error' && 'text-destructive',
						task.status === 'success' && 'text-success',
					)}
				>
					{statusText}
				</span>
				{groupRetry && (
					<Button
						variant="ghost"
						size="sm"
						className="h-6 shrink-0 px-1.5 text-[11px]"
						onClick={groupRetry}
					>
						<RotateCcw className="mr-1 h-3 w-3" />
						{task.kind === 'add' && hasItemError ? '重试失败项' : '重试'}
					</Button>
				)}
				{task.status !== 'running' && (
					<Button
						variant="ghost"
						size="icon-sm"
						className="-mr-1 h-6 w-6 shrink-0"
						onClick={requestClose}
						aria-label="移除任务"
					>
						<X className="h-3.5 w-3.5" />
					</Button>
				)}
			</div>
			{task.error && !hasItemError && (
				<p className="ml-7 mt-1 truncate text-[11px] text-destructive" title={task.error}>
					{task.error}
				</p>
			)}
			{task.status === 'running' && (
				<div
					className="ml-7 mt-2 h-1 overflow-hidden rounded-full bg-primary/20"
					role="progressbar"
					tabIndex={0}
					aria-label={`${task.title}总进度`}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={percent}
				>
					<div
						className="h-full rounded-full bg-primary transition-[width] duration-200"
						style={{ width: `${percent}%` }}
					/>
				</div>
			)}
			<div className="ml-6 mt-1.5 flex max-h-32 flex-col gap-1 overflow-y-auto pl-3">
				{task.items.map((item, index) => (
					<TaskItemRow
						key={item.id}
						task={task}
						item={item}
						isLast={index === task.items.length - 1}
						onRetry={
							task.status === 'error' && task.items.length === 1 && item.status === 'error'
								? () => retryTask(task.id)
								: undefined
						}
					/>
				))}
			</div>
			{task.kind === 'add' && task.status === 'success' && (
				<Button
					variant="ghost"
					size="sm"
					className="ml-6 mt-0.5 h-6 px-1 text-[11px]"
					onClick={() => navigate('/briar/files')}
				>
					<FileCheck2 className="mr-1 h-3 w-3" />
					到文件中查看
				</Button>
			)}
		</section>
	)
}

export default function MediaTaskCenter() {
	const { tasks } = useMediaTasks()
	const [expanded, setExpanded] = useState(false)
	const [open, setOpen] = useState(false)
	const prevNewestId = useRef<string | undefined>(undefined)
	const newestId = tasks[0]?.id
	if (newestId && newestId !== prevNewestId.current) {
		prevNewestId.current = newestId
		if (!open) setOpen(true)
	}
	const close = useCallback(() => {
		setOpen(false)
		setExpanded(false)
	}, [])
	const { closing, requestClose, state } = useExitAnimation(close)
	if (!open) return null
	const running = tasks.filter((task) => task.status === 'running').length
	const featured = tasks.find((task) => task.status === 'running') ?? tasks[0]
	const featuredPercent = featured ? getMediaTaskPercent(featured) : 0
	const summary =
		tasks.length === 0
			? '暂无任务'
			: running > 0
				? `${running} 个进行中`
				: `${tasks.length} 个已结束`

	return (
		<aside
			className="rv-media-task-center rv-motion-dialog fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-[70] w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-xl border bg-background/95 shadow-2xl backdrop-blur-md sm:bottom-6 sm:right-6"
			data-state={state}
			aria-label="媒体任务中心"
			aria-hidden={closing}
		>
			<header className={cn('flex items-center gap-1 pr-2', expanded && 'border-b')}>
				<Button
					variant="ghost"
					className="h-auto min-w-0 flex-1 justify-start rounded-none px-3 py-2 text-left shadow-none [&>.rv-control-label]:w-full"
					onClick={() => setExpanded((value) => !value)}
					aria-expanded={expanded}
					aria-label={expanded ? '收起媒体任务' : '展开媒体任务'}
				>
					<span className="flex w-full items-center gap-2.5">
						<TaskRing percent={featuredPercent} status={featured?.status ?? 'idle'} />
						<span className="min-w-0 flex-1">
							<span className="block text-sm font-semibold">媒体任务</span>
							<span className="mt-0.5 block truncate text-[11px] font-normal text-muted-foreground">
								{featured ? `${summary} · ${featured.title}` : summary}
							</span>
						</span>
					</span>
				</Button>
				<Button
					variant="ghost"
					size="icon-sm"
					className="h-8 w-8 shrink-0"
					onClick={requestClose}
					aria-label="关闭媒体任务中心"
					title="关闭面板，后台任务继续"
				>
					<X className="h-4 w-4" />
				</Button>
				<Button
					variant="ghost"
					size="icon-sm"
					className="h-8 w-8 shrink-0"
					onClick={() => setExpanded((value) => !value)}
					aria-expanded={expanded}
					aria-label={expanded ? '收起媒体任务' : '展开媒体任务'}
				>
					<ChevronDown
						className={cn('h-4 w-4 transition-transform duration-300', !expanded && 'rotate-180')}
					/>
				</Button>
			</header>
			<div
				className={cn(
					'grid transition-[grid-template-rows,opacity] duration-300 ease-out',
					expanded
						? 'grid-rows-[1fr] opacity-100'
						: 'pointer-events-none grid-rows-[0fr] opacity-0',
				)}
				aria-hidden={!expanded}
				inert={!expanded}
			>
				<div className="min-h-0 overflow-hidden">
					<div className="max-h-[min(560px,calc(100dvh-8rem))] overflow-y-auto p-2">
						<div className="flex flex-col gap-2">
							{tasks.length === 0 ? (
								<p className="px-1 py-6 text-center text-xs text-muted-foreground">暂无任务</p>
							) : (
								tasks.map((task) => <TaskCard key={task.id} task={task} />)
							)}
						</div>
						<footer className="mt-2 border-t px-1 pb-0.5 pt-2 text-[11px] text-muted-foreground">
							站内切换保留任务；刷新或关闭页面会中断。
						</footer>
					</div>
				</div>
			</div>
		</aside>
	)
}
