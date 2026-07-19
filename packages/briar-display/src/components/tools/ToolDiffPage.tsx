'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { type Change, diffLines } from 'diff'
import {
	ChevronLeft,
	ChevronRight,
	Clock,
	FileDiff,
	FileUp,
	RotateCcw,
	Rows3,
	SplitSquareHorizontal,
	Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import ToolsLayout from './ToolsLayout'
import {
	type DiffStats,
	type HistoryEntry,
	MAX_HISTORY,
	type ViewMode,
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

function UnifiedView({ changes }: { changes: Change[] }) {
	let lineNum = 0
	return (
		<pre className="overflow-x-auto rounded-md border bg-muted/30 p-4 font-mono text-sm leading-relaxed">
			{changes.map((change, ci) => {
				const lines = change.value.split('\n')
				if (lines[lines.length - 1] === '') lines.pop()
				return lines.map((line, li) => {
					lineNum++
					const bg = change.added
						? 'bg-green-100 text-green-900'
						: change.removed
							? 'bg-red-100 text-red-900'
							: ''
					const prefix = change.added ? '+' : change.removed ? '-' : ' '
					return (
						<div key={`${ci}-${li}`} className={`px-1 ${bg}`}>
							<span className="mr-3 inline-block w-8 select-none text-right text-muted-foreground">
								{change.removed ? '' : lineNum}
							</span>
							<span className="mr-1 select-none text-muted-foreground">{prefix}</span>
							{line}
						</div>
					)
				})
			})}
		</pre>
	)
}

function SplitView({ changes }: { changes: Change[] }) {
	const leftLines: { text: string; type: 'normal' | 'removed' }[] = []
	const rightLines: { text: string; type: 'normal' | 'added' }[] = []

	for (const change of changes) {
		const lines = change.value.split('\n')
		if (lines[lines.length - 1] === '') lines.pop()

		if (!change.added && !change.removed) {
			for (const line of lines) {
				leftLines.push({ text: line, type: 'normal' })
				rightLines.push({ text: line, type: 'normal' })
			}
		} else if (change.removed) {
			for (const line of lines) {
				leftLines.push({ text: line, type: 'removed' })
				rightLines.push({ text: '', type: 'normal' })
			}
		} else if (change.added) {
			for (const line of lines) {
				leftLines.push({ text: '', type: 'normal' })
				rightLines.push({ text: line, type: 'added' })
			}
		}
	}

	return (
		<div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border">
			<pre className="overflow-x-auto bg-muted/30 p-4 font-mono text-sm leading-relaxed">
				{leftLines.map((item, i) => {
					const bg = item.type === 'removed' ? 'bg-red-100 text-red-900' : ''
					return (
						<div key={i} className={`px-1 ${bg}`}>
							<span className="mr-3 inline-block w-8 select-none text-right text-muted-foreground">
								{item.type !== 'removed' ? i + 1 : ''}
							</span>
							{item.text || '\u00A0'}
						</div>
					)
				})}
			</pre>
			<pre className="overflow-x-auto bg-muted/30 p-4 font-mono text-sm leading-relaxed">
				{rightLines.map((item, i) => {
					const bg = item.type === 'added' ? 'bg-green-100 text-green-900' : ''
					return (
						<div key={i} className={`px-1 ${bg}`}>
							<span className="mr-3 inline-block w-8 select-none text-right text-muted-foreground">
								{item.type !== 'added' ? i + 1 : ''}
							</span>
							{item.text || '\u00A0'}
						</div>
					)
				})}
			</pre>
		</div>
	)
}

export default function ToolDiffPage() {
	const [leftText, setLeftText] = useState('')
	const [rightText, setRightText] = useState('')
	const [changes, setChanges] = useState<Change[] | null>(null)
	const [viewMode, setViewMode] = useState<ViewMode>('split')
	const [stats, setStats] = useState<DiffStats | null>(null)
	const [history, setHistory] = useState<HistoryEntry[]>([])
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
	const [now, setNow] = useState(0)

	const leftRef = useRef<HTMLTextAreaElement>(null)
	const rightRef = useRef<HTMLTextAreaElement>(null)

	// 客户端加载历史记录和缓存（避免 SSR hydration 不匹配）
	useEffect(() => {
		setHistory(loadHistory())
		setNow(Date.now())
		const cache = loadCache()
		if (cache.leftText) setLeftText(String(cache.leftText))
		if (cache.rightText) setRightText(String(cache.rightText))
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
		<ToolsLayout currentPath="/briar-display/tools/diff">
			<Card className="flex min-h-0 flex-1 flex-col">
				<CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
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
					<div className="flex min-h-0 flex-1 gap-4">
						{/* 历史侧边栏 */}
						{sidebarCollapsed ? (
							<div className="flex w-8 shrink-0 flex-col items-center rounded-md border bg-muted/20">
								<button
									onClick={() => setSidebarCollapsed(false)}
									className="mt-2 flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
									title="展开历史记录"
								>
									<ChevronRight className="h-4 w-4" />
								</button>
								{history.length > 0 && (
									<span className="mt-1 text-[10px] font-medium text-muted-foreground">
										{history.length}
									</span>
								)}
							</div>
						) : (
							<div className="flex w-[220px] shrink-0 flex-col rounded-md border bg-muted/20">
								<div className="flex items-center justify-between border-b px-3 py-2">
									<span className="text-sm font-medium">历史记录</span>
									<div className="flex items-center gap-1">
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
										<Button
											variant="ghost"
											size="sm"
											onClick={() => setSidebarCollapsed(true)}
											className="h-auto p-1 text-muted-foreground hover:text-foreground"
											title="收起历史记录"
										>
											<ChevronLeft className="h-4 w-4" />
										</Button>
									</div>
								</div>
								<div className="flex-1 overflow-y-auto">
									{history.length === 0 ? (
										<div className="flex flex-col items-center justify-center py-8 text-xs text-muted-foreground">
											<Clock className="mb-2 h-6 w-6 opacity-40" />
											暂无历史记录
										</div>
									) : (
										history.map((entry) => (
											<div
												key={entry.id}
												onClick={() => handleRestore(entry)}
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
										))
									)}
								</div>
							</div>
						)}

						{/* 主内容区 */}
						<div className="flex min-h-0 flex-1 flex-col space-y-4">
							{/* 编辑区 */}
							<div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
								<div
									onDrop={handleFileDrop('left')}
									onDragOver={(e) => e.preventDefault()}
									className="relative flex min-h-0 flex-col"
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
										className="min-h-0 flex-1 resize-none font-mono text-sm"
									/>
								</div>
								<div
									onDrop={handleFileDrop('right')}
									onDragOver={(e) => e.preventDefault()}
									className="relative flex min-h-0 flex-col"
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
										className="min-h-0 flex-1 resize-none font-mono text-sm"
									/>
								</div>
							</div>

							{/* 统计 */}
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

							{/* Diff 结果 */}
							{changes && (
								<div>
									{viewMode === 'split' ? (
										<SplitView changes={changes} />
									) : (
										<UnifiedView changes={changes} />
									)}
								</div>
							)}
						</div>
					</div>
				</CardContent>
			</Card>
		</ToolsLayout>
	)
}
