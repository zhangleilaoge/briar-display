'use client'

import {
	type DeployRunLogs,
	type DeployRunProgress,
	getDeployLive,
	getDeployLogs,
	getDeployProgress,
} from '@/api/deploy'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import Ansi from 'ansi-to-react'
import axios from 'axios'
import { Check, Copy, Loader2, Maximize2, Minimize2, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import DeployProgressView from './DeployProgressView'

interface DeployLogDialogProps {
	runId: string | null
	open: boolean
	onOpenChange: (open: boolean) => void
}

const POLL_INTERVAL = 5000

/**
 * 发布日志弹窗：伪命令行界面展示 GitHub CI 日志
 * 运行中的部署每 5s 轮询追加
 */
export default function DeployLogDialog({ runId, open, onOpenChange }: DeployLogDialogProps) {
	const [data, setData] = useState<DeployRunLogs | null>(null)
	const [progress, setProgress] = useState<DeployRunProgress | null>(null)
	const [liveLines, setLiveLines] = useState<string[] | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)
	const [fullscreen, setFullscreen] = useState(false)
	const [copied, setCopied] = useState(false)
	const bodyRef = useRef<HTMLDivElement>(null)
	// open 的 ref 镜像：关闭弹窗后，残留定时器/在途响应触发的 fetchLogs 直接变成无操作
	const openRef = useRef(open)

	/** 复制时剥离 ANSI 转义序列，粘贴出来是干净文本 */
	const handleCopy = () => {
		if (!data) return
		// biome-ignore lint/suspicious/noControlCharactersInRegex: 剥离 ANSI 颜色转义码
		navigator.clipboard.writeText(data.logs.replace(/\u001b\[[0-9;]*m/g, ''))
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}

	/** 从 axios 错误里提取后端给的具体原因（如 GitHub 401/404） */
	const extractError = (e: unknown, fallback: string) =>
		(axios.isAxiosError(e) ? e.response?.data?.message : undefined) ||
		(e instanceof Error ? e.message : fallback)

	const fetchLogs = useCallback(async () => {
		if (!runId || !openRef.current) return
		try {
			const res = await getDeployLogs(runId)
			if (res.success && res.data) {
				setData(res.data)
				setError(null)
			} else {
				setError(res.message || '日志拉取失败')
			}
		} catch (e) {
			setError(extractError(e, '日志拉取失败'))
		} finally {
			setLoading(false)
		}
	}, [runId])

	/** 步骤级实时进度（运行中可用）；run 完成后顺带拉一次完整日志 */
	const fetchProgress = useCallback(async () => {
		if (!runId || !openRef.current) return
		try {
			const res = await getDeployProgress(runId)
			if (res.success && res.data) {
				setProgress(res.data)
				setError(null)
				if (res.data.runStatus === 'completed') fetchLogs()
			} else {
				setError(res.message || '进度拉取失败')
			}
		} catch (e) {
			setError(extractError(e, '进度拉取失败'))
		} finally {
			setLoading(false)
		}
	}, [runId, fetchLogs])

	/** 服务器 deploy.sh 行级输出（仅当进度文件属于本次 run 才展示） */
	const fetchLive = useCallback(async () => {
		if (!runId || !openRef.current) return
		try {
			const res = await getDeployLive()
			if (res.success && res.data?.available && res.data.runId === runId) {
				setLiveLines(res.data.lines)
			} else {
				setLiveLines(null)
			}
		} catch {
			/* 本地开发等场景没有进度文件，静默忽略 */
		}
	}, [runId])

	const inProgress = progress != null && progress.runStatus !== 'completed'

	const handleRefresh = () => {
		setLoading(true)
		if (inProgress || !data) {
			fetchProgress()
			fetchLive()
		} else {
			fetchLogs()
		}
	}

	// 同步 open 到 ref（声明顺序先于下方 fetch 相关 effect，保证首次加载时已是 true）
	// 关闭时清空数据，避免残留 in_progress 状态
	useEffect(() => {
		openRef.current = open
		if (!open) {
			setData(null)
			setProgress(null)
			setLiveLines(null)
		}
	}, [open])

	// 打开时首次加载（先拉进度：进行中可用且响应快；已完成时进度接口会顺带触发日志拉取）
	useEffect(() => {
		if (open && runId) {
			setData(null)
			setProgress(null)
			setLiveLines(null)
			setError(null)
			setLoading(true)
			fetchProgress()
			fetchLive()
		}
	}, [open, runId, fetchProgress, fetchLive])

	// 运行未完成时轮询进度 + 服务器行级输出
	useEffect(() => {
		if (!open || !inProgress) return
		const timer = setInterval(() => {
			fetchProgress()
			fetchLive()
		}, POLL_INTERVAL)
		return () => clearInterval(timer)
	}, [open, inProgress, fetchProgress, fetchLive])

	// 新内容到底时自动滚动到底部
	useEffect(() => {
		const el = bodyRef.current
		if (el) el.scrollTop = el.scrollHeight
	}, [data?.logs, liveLines])

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{/* [&>button]:hidden 隐藏 Dialog 自带的右上角关闭按钮（与终端标题栏风格冲突），仍可 Esc/点击遮罩关闭 */}
			<DialogContent
				className={cn(
					'flex flex-col gap-0 overflow-hidden border-zinc-700 bg-zinc-950 p-0 text-zinc-100 [&>button]:hidden',
					fullscreen ? 'h-screen max-w-none w-screen rounded-none' : 'max-w-4xl',
				)}
			>
				{/* 终端标题栏（红点可点击关闭） */}
				<div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-4 py-2.5">
					<button
						type="button"
						onClick={() => onOpenChange(false)}
						className="h-3 w-3 rounded-full bg-red-500 transition-opacity hover:opacity-70"
						title="关闭"
					/>
					<span className="h-3 w-3 rounded-full bg-yellow-500" />
					<span className="h-3 w-3 rounded-full bg-green-500" />
					<DialogTitle className="ml-2 font-mono text-xs text-zinc-400">
						github-actions — run #{runId}
					</DialogTitle>
					<div className="ml-auto flex items-center gap-2">
						{(data ?? progress) && (
							<span
								className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
									(data ?? progress)!.runStatus === 'completed'
										? (data ?? progress)!.conclusion === 'success'
											? 'bg-green-500/15 text-green-400'
											: 'bg-red-500/15 text-red-400'
										: 'bg-blue-500/15 text-blue-400'
								}`}
							>
								{(data ?? progress)!.runStatus === 'completed'
									? ((data ?? progress)!.conclusion ?? 'completed')
									: (data ?? progress)!.runStatus}
							</span>
						)}
						<button
							type="button"
							onClick={handleCopy}
							disabled={!data}
							className="text-zinc-500 transition-colors hover:text-zinc-200 disabled:opacity-40"
							title="复制日志（纯文本）"
						>
							{copied ? (
								<Check className="h-3.5 w-3.5 text-green-400" />
							) : (
								<Copy className="h-3.5 w-3.5" />
							)}
						</button>
						<button
							type="button"
							onClick={handleRefresh}
							className="text-zinc-500 transition-colors hover:text-zinc-200"
							title="刷新"
						>
							<RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
						</button>
						<button
							type="button"
							onClick={() => setFullscreen((v) => !v)}
							className="text-zinc-500 transition-colors hover:text-zinc-200"
							title={fullscreen ? '退出全屏' : '全屏'}
						>
							{fullscreen ? (
								<Minimize2 className="h-3.5 w-3.5" />
							) : (
								<Maximize2 className="h-3.5 w-3.5" />
							)}
						</button>
					</div>
				</div>

				{/* 终端内容区 */}
				<div
					ref={bodyRef}
					className={cn(
						'overflow-auto bg-zinc-950 p-4 font-mono text-xs leading-relaxed',
						fullscreen ? 'min-h-0 flex-1' : 'h-[65vh]',
					)}
				>
					{loading && !progress && !data ? (
						<div className="flex items-center gap-2 text-zinc-500">
							<Loader2 className="h-4 w-4 animate-spin" />
							正在拉取部署状态...
						</div>
					) : error && !progress && !data ? (
						<p className="text-red-400">$ fetch status → error: {error}</p>
					) : inProgress && progress ? (
						<>
							<DeployProgressView progress={progress} liveLines={liveLines} />
							<p className="mt-3 animate-pulse text-blue-400">▊ 部署进行中，每 5s 自动刷新...</p>
						</>
					) : data ? (
						// whitespace-pre 保持等宽对齐（如 PM2 表格），长行横向滚动而非折行错位
						<pre className="whitespace-pre">
							<Ansi linkify={false}>{data.logs}</Ansi>
						</pre>
					) : null}
				</div>
			</DialogContent>
		</Dialog>
	)
}
