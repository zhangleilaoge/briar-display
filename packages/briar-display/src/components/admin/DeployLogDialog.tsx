'use client'

import { type DeployRunLogs, getDeployLogs } from '@/api/deploy'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import Ansi from 'ansi-to-react'
import axios from 'axios'
import { Check, Copy, Loader2, Maximize2, Minimize2, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

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
	const [error, setError] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)
	const [fullscreen, setFullscreen] = useState(false)
	const [copied, setCopied] = useState(false)
	const bodyRef = useRef<HTMLDivElement>(null)

	/** 复制时剥离 ANSI 转义序列，粘贴出来是干净文本 */
	const handleCopy = () => {
		if (!data) return
		// biome-ignore lint/suspicious/noControlCharactersInRegex: 剥离 ANSI 颜色转义码
		navigator.clipboard.writeText(data.logs.replace(/\u001b\[[0-9;]*m/g, ''))
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}

	const fetchLogs = useCallback(async () => {
		if (!runId) return
		try {
			const res = await getDeployLogs(runId)
			if (res.success && res.data) {
				setData(res.data)
				setError(null)
			} else {
				setError(res.message || '日志拉取失败')
			}
		} catch (e) {
			// 后端 400 响应里带了具体原因（如 GitHub 401/404），优先展示
			const serverMessage = axios.isAxiosError(e) ? e.response?.data?.message : undefined
			setError(serverMessage || (e instanceof Error ? e.message : '日志拉取失败'))
		} finally {
			setLoading(false)
		}
	}, [runId])

	// 打开时首次加载
	useEffect(() => {
		if (open && runId) {
			setData(null)
			setError(null)
			setLoading(true)
			fetchLogs()
		}
	}, [open, runId, fetchLogs])

	// 运行未完成时轮询
	useEffect(() => {
		if (!open || !data || data.runStatus === 'completed') return
		const timer = setInterval(fetchLogs, POLL_INTERVAL)
		return () => clearInterval(timer)
	}, [open, data, fetchLogs])

	// 新日志到底时自动滚动到底部
	useEffect(() => {
		const el = bodyRef.current
		if (el) el.scrollTop = el.scrollHeight
	}, [data?.logs])

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
						{data && (
							<span
								className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
									data.runStatus === 'completed'
										? data.conclusion === 'success'
											? 'bg-green-500/15 text-green-400'
											: 'bg-red-500/15 text-red-400'
										: 'bg-blue-500/15 text-blue-400'
								}`}
							>
								{data.runStatus === 'completed' ? (data.conclusion ?? 'completed') : data.runStatus}
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
							onClick={() => {
								setLoading(true)
								fetchLogs()
							}}
							className="text-zinc-500 transition-colors hover:text-zinc-200"
							title="刷新日志"
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
					{loading && !data ? (
						<div className="flex items-center gap-2 text-zinc-500">
							<Loader2 className="h-4 w-4 animate-spin" />
							正在拉取日志...
						</div>
					) : error ? (
						<p className="text-red-400">$ fetch logs → error: {error}</p>
					) : data ? (
						// whitespace-pre 保持等宽对齐（如 PM2 表格），长行横向滚动而非折行错位
						<pre className="whitespace-pre">
							<Ansi linkify={false}>{data.logs}</Ansi>
						</pre>
					) : null}
					{data && data.runStatus !== 'completed' && (
						<p className="mt-2 animate-pulse text-blue-400">▊ 部署进行中，每 5s 自动刷新...</p>
					)}
				</div>
			</DialogContent>
		</Dialog>
	)
}
