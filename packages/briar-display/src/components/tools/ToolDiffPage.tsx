'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { type Change, diffLines } from 'diff'
import {
	CircleCheck,
	Clock,
	FileDiff,
	FileUp,
	RotateCcw,
	Rows3,
	SplitSquareHorizontal,
	Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SplitView, UnifiedView } from './ToolDiffViews'
import ToolsLayout from './ToolsLayout'
import {
	type DiffStats,
	type HistoryEntry,
	MAX_HISTORY,
	type ViewMode,
	buildDiffSegments,
	clearCache,
	computeStats,
	formatFullTime,
	formatRelativeTime,
	formatSize,
	loadCache,
	loadHistory,
	saveCache,
	saveHistory,
} from './toolDiffUtils'

export default function ToolDiffPage() {
	const [leftText, setLeftText] = useState('')
	const [rightText, setRightText] = useState('')
	const [changes, setChanges] = useState<Change[] | null>(null)
	const [viewMode, setViewMode] = useState<ViewMode>('split')
	const [stats, setStats] = useState<DiffStats | null>(null)
	const [history, setHistory] = useState<HistoryEntry[]>([])
	const [now, setNow] = useState(0)
	const [expanded, setExpanded] = useState<Set<number>>(new Set())

	const leftRef = useRef<HTMLTextAreaElement>(null)
	const rightRef = useRef<HTMLTextAreaElement>(null)
	const resultRef = useRef<HTMLDivElement>(null)

	// GitLab 风格分段：变更行保留上下文，其余相同区域折叠
	const segments = useMemo(() => (changes ? buildDiffSegments(changes) : null), [changes])

	// 比较完成后滚动到结果区域
	useEffect(() => {
		if (changes) {
			resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
		}
	}, [changes])

	const toggleSegment = useCallback((index: number) => {
		setExpanded((prev) => {
			const next = new Set(prev)
			if (next.has(index)) next.delete(index)
			else next.add(index)
			return next
		})
	}, [])

	// 客户端加载历史记录和缓存（避免 SSR hydration 不匹配）
	useEffect(() => {
		setHistory(loadHistory())
		setNow(Date.now())
		const cache = loadCache()
		if (cache.leftText) setLeftText(String(cache.leftText))
		if (cache.rightText) setRightText(String(cache.rightText))
		// 窄屏默认统一视图（客户端挂载后切换，避免 SSR hydration 不匹配）
		if (window.innerWidth < 640) setViewMode('unified')
	}, [])

	// 保存历史
	useEffect(() => {
		saveHistory(history)
	}, [history])

	// 保存缓存（带 debounce）
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	useEffect(() => {
		if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
		saveTimerRef.current = setTimeout(() => {
			saveCache(leftText, rightText)
		}, 500)
		return () => {
			if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
		}
	}, [leftText, rightText])

	const pushHistory = useCallback((prevLeft: string, prevRight: string) => {
		setHistory((h) =>
			[
				{
					id: crypto.randomUUID(),
					leftText: prevLeft,
					rightText: prevRight,
					timestamp: Date.now(),
				},
				...h,
			].slice(0, MAX_HISTORY),
		)
	}, [])

	const handleCompare = useCallback(() => {
		if (!leftText && !rightText) return
		const result = diffLines(leftText, rightText)
		setChanges(result)
		setStats(computeStats(result))
		setExpanded(new Set())
		pushHistory(leftText, rightText)
	}, [leftText, rightText, pushHistory])

	const handleRestore = useCallback((entry: HistoryEntry) => {
		setLeftText(entry.leftText)
		setRightText(entry.rightText)
		setChanges(null)
		setStats(null)
	}, [])

	const handleDeleteHistory = useCallback((id: string) => {
		setHistory((prev) => prev.filter((e) => e.id !== id))
	}, [])

	const handleClearHistory = useCallback(() => {
		setHistory([])
	}, [])

	const handleClear = useCallback(() => {
		setLeftText('')
		setRightText('')
		setChanges(null)
		setStats(null)
		clearCache()
	}, [])

	const handleFileDrop = useCallback(
		(side: 'left' | 'right') => (e: React.DragEvent) => {
			e.preventDefault()
			const file = e.dataTransfer.files[0]
			if (!file) return
			const reader = new FileReader()
			reader.onload = () => {
				const text = reader.result as string
				if (side === 'left') setLeftText(text)
				else setRightText(text)
			}
			reader.readAsText(file)
		},
		[],
	)

	const handleFileClick = useCallback(
		(side: 'left' | 'right') => () => {
			const input = document.createElement('input')
			input.type = 'file'
			input.accept =
				'.txt,.json,.xml,.csv,.js,.ts,.tsx,.jsx,.html,.css,.md,.py,.java,.go,.rs,.sql,.yaml,.yml,.toml,.cfg,.ini,.log,.diff,.patch,*/*'
			input.onchange = () => {
				const file = input.files?.[0]
				if (!file) return
				const reader = new FileReader()
				reader.onload = () => {
					const text = reader.result as string
					if (side === 'left') setLeftText(text)
					else setRightText(text)
				}
				reader.readAsText(file)
			}
			input.click()
		},
		[],
	)

	return (
		<ToolsLayout currentPath="/briar/tools/diff">
			<Card className="glass flex shrink-0 flex-col">
				<CardHeader className="flex-col items-start gap-3 space-y-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
					<CardTitle className="flex items-center gap-2 text-lg">
						<FileDiff className="h-5 w-5" />
						在线文件 Diff
					</CardTitle>
					<div className="flex items-center gap-2">
						{changes && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setViewMode(viewMode === 'split' ? 'unified' : 'split')}
								className="gap-1.5"
							>
								{viewMode === 'split' ? (
									<>
										<Rows3 className="h-4 w-4" />
										统一视图
									</>
								) : (
									<>
										<SplitSquareHorizontal className="h-4 w-4" />
										分屏视图
									</>
								)}
							</Button>
						)}
						<Button variant="outline" size="sm" onClick={handleClear} className="gap-1.5">
							<RotateCcw className="h-4 w-4" />
							清空
						</Button>
						<Button size="sm" onClick={handleCompare} className="gap-1.5">
							<FileDiff className="h-4 w-4" />
							比较
						</Button>
					</div>
				</CardHeader>
				<CardContent className="flex min-h-0 flex-1 flex-col">
					<div className="flex min-h-0 flex-1 flex-col gap-4">
						{/* 主内容区（页面级滚动，历史在首屏外） */}
						<div className="flex flex-col space-y-4">
							{/* 编辑区：占满首屏剩余高度 */}
							<div className="grid h-[calc(100dvh-19rem)] min-h-[360px] shrink-0 grid-cols-1 grid-rows-2 gap-4 sm:h-[calc(100dvh-17.5rem)] sm:grid-cols-2 sm:grid-rows-1 lg:h-[calc(100dvh-14rem)] lg:min-h-[280px]">
								<div
									onDrop={handleFileDrop('left')}
									onDragOver={(e) => e.preventDefault()}
									className="relative flex flex-col"
								>
									<div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
										<span>原始文本</span>
										<Button
											variant="link"
											size="sm"
											onClick={handleFileClick('left')}
											className="h-auto p-0 text-xs"
										>
											<FileUp className="h-3 w-3" />
											上传文件
										</Button>
									</div>
									<Textarea
										ref={leftRef}
										value={leftText}
										onChange={(e) => setLeftText(e.target.value)}
										placeholder="粘贴原始文本，或拖拽文件到此处..."
										className="h-full resize-none font-mono text-sm"
									/>
								</div>
								<div
									onDrop={handleFileDrop('right')}
									onDragOver={(e) => e.preventDefault()}
									className="relative flex flex-col"
								>
									<div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
										<span>修改后文本</span>
										<Button
											variant="link"
											size="sm"
											onClick={handleFileClick('right')}
											className="h-auto p-0 text-xs"
										>
											<FileUp className="h-3 w-3" />
											上传文件
										</Button>
									</div>
									<Textarea
										ref={rightRef}
										value={rightText}
										onChange={(e) => setRightText(e.target.value)}
										placeholder="粘贴修改后文本，或拖拽文件到此处..."
										className="h-full resize-none font-mono text-sm"
									/>
								</div>
							</div>

							{/* Diff 结果：固定高度，内部滚动 */}
							{changes && segments && (
								<div ref={resultRef} className="flex shrink-0 scroll-mt-4 flex-col gap-2">
									{stats && (
										<div className="flex items-center gap-3 text-sm">
											<span className="text-muted-foreground">结果：</span>
											<Badge variant="outline" className="bg-green-50 text-green-700">
												+{stats.added} 行新增
											</Badge>
											<Badge variant="outline" className="bg-red-50 text-red-700">
												-{stats.removed} 行删除
											</Badge>
										</div>
									)}
									<div className="h-[70dvh] min-h-[280px]">
										{stats && stats.added === 0 && stats.removed === 0 ? (
											<div className="flex h-full flex-col items-center justify-center gap-2 rounded-md border bg-muted/30 text-sm text-muted-foreground">
												<CircleCheck className="h-8 w-8 text-green-600/70 dark:text-green-400/70" />
												两段文本完全相同，无差异
											</div>
										) : viewMode === 'split' ? (
											<SplitView segments={segments} expanded={expanded} onToggle={toggleSegment} />
										) : (
											<UnifiedView
												segments={segments}
												expanded={expanded}
												onToggle={toggleSegment}
											/>
										)}
									</div>
								</div>
							)}
						</div>
					</div>
				</CardContent>
			</Card>

			{/* 历史记录（首屏外，向下滚动可见） */}
			<div className="glass mt-4 shrink-0 rounded-xl sm:mt-6">
				<div className="flex items-center justify-between border-b px-3 py-2">
					<span className="text-sm font-medium">
						历史记录
						{history.length > 0 && (
							<span className="ml-1.5 text-xs font-normal text-muted-foreground">
								({history.length})
							</span>
						)}
					</span>
					{history.length > 0 && (
						<Button
							variant="ghost"
							size="sm"
							onClick={handleClearHistory}
							className="h-auto p-1 text-xs text-muted-foreground hover:text-destructive"
						>
							<Trash2 className="h-3.5 w-3.5" />
						</Button>
					)}
				</div>
				<div className="max-h-52 overflow-y-auto p-2">
					{history.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-6 text-xs text-muted-foreground">
							<Clock className="mb-2 h-6 w-6 opacity-40" />
							暂无历史记录
						</div>
					) : (
						<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
							{history.map((entry) => (
								<div
									key={entry.id}
									onClick={() => handleRestore(entry)}
									className="group flex cursor-pointer flex-col rounded-md border border-white/70 bg-white/75 px-3 py-2.5 text-left transition-colors hover:bg-white"
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
												handleDeleteHistory(entry.id)
											}}
											className="h-auto p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
										>
											<Trash2 className="h-3 w-3" />
										</Button>
									</div>
									<span className="mt-0.5 text-[11px] text-muted-foreground">
										{formatFullTime(entry.timestamp)} ·{' '}
										{formatSize(entry.leftText + entry.rightText)}
									</span>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</ToolsLayout>
	)
}
