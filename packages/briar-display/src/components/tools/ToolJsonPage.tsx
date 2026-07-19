'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
	Braces,
	Check,
	ChevronLeft,
	ChevronRight,
	Clock,
	Code,
	Copy,
	Download,
	Eraser,
	FileJson,
	FileUp,
	Minus,
	RotateCcw,
	Shield,
	Trash2,
	WrapText,
} from 'lucide-react'
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ToolsLayout from './ToolsLayout'
import {
	ACTIONS,
	type ActionKey,
	type HistoryEntry,
	computeTags,
	executeAction,
	formatFullTime,
	formatRelativeTime,
	formatSize,
	isObjectLiteral,
	loadHistory,
	parseForPreview,
	saveHistory,
} from './toolJsonUtils'

const ReactJson = lazy(() => import('react-json-view').then((mod) => ({ default: mod.default })))

export default function ToolJsonPage() {
	const [input, setInput] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [copied, setCopied] = useState(false)
	const [history, setHistory] = useState<HistoryEntry[]>([])
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
	const [treeKey, setTreeKey] = useState(0)
	const [treeCollapsed, setTreeCollapsed] = useState<boolean | number>(1)
	const [now, setNow] = useState(0)
	const inputRef = useRef<HTMLTextAreaElement>(null)

	// 客户端加载历史记录（避免 SSR hydration 不匹配）
	useEffect(() => {
		const saved = loadHistory()
		setHistory(saved)
		if (saved[0]?.input) setInput(saved[0].input)
		setNow(Date.now())
	}, [])

	useEffect(() => {
		saveHistory(history)
	}, [history])

	const { parsedValue, isObjectInput } = useMemo(() => parseForPreview(input), [input])
	const objLiteral = useMemo(() => isObjectLiteral(input), [input])

	const pushHistory = useCallback((prevInput: string, action: ActionKey) => {
		setHistory((h) =>
			[
				{
					id: crypto.randomUUID(),
					input: prevInput,
					action,
					timestamp: Date.now(),
					tags: computeTags(prevInput),
				},
				...h,
			].slice(0, 50),
		)
	}, [])

	const handleAction = useCallback(
		(key: ActionKey) => {
			setError(null)
			setCopied(false)
			if (!input.trim()) return

			try {
				const result = executeAction(key, input)
				setInput(result)
				pushHistory(result, key)
			} catch (e) {
				setError((e as Error).message)
			}
		},
		[input, pushHistory],
	)

	const handleClear = useCallback(() => {
		setInput('')
		setError(null)
		setCopied(false)
		inputRef.current?.focus()
	}, [])

	const handleCopy = useCallback(() => {
		if (!input) return
		navigator.clipboard.writeText(input).then(() => {
			setCopied(true)
			setTimeout(() => setCopied(false), 1500)
		})
	}, [input])

	const handleDownload = useCallback(() => {
		if (!input) return
		const blob = new Blob([input], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `formatted-${Date.now()}.json`
		a.click()
		URL.revokeObjectURL(url)
	}, [input])

	const handleFileUpload = useCallback(() => {
		const inputEl = document.createElement('input')
		inputEl.type = 'file'
		inputEl.accept = '.json,.txt,application/json,text/plain'
		inputEl.onchange = () => {
			const file = inputEl.files?.[0]
			if (!file) return
			const reader = new FileReader()
			reader.onload = () => {
				setInput(reader.result as string)
				setError(null)
			}
			reader.readAsText(file)
		}
		inputEl.click()
	}, [])

	const handleDrop = useCallback((e: React.DragEvent) => {
		e.preventDefault()
		const file = e.dataTransfer.files[0]
		if (!file) return
		const reader = new FileReader()
		reader.onload = () => {
			setInput(reader.result as string)
			setError(null)
		}
		reader.readAsText(file)
	}, [])

	const handleExpandAll = useCallback(() => {
		setTreeCollapsed(false)
		setTreeKey((k) => k + 1)
	}, [])

	const handleCollapseAll = useCallback(() => {
		setTreeCollapsed(true)
		setTreeKey((k) => k + 1)
	}, [])

	const handleRestore = useCallback((entry: HistoryEntry) => {
		setInput(entry.input)
		setError(null)
	}, [])

	const handleDeleteHistory = useCallback((id: string) => {
		setHistory((prev) => prev.filter((e) => e.id !== id))
	}, [])

	const handleClearHistory = useCallback(() => {
		setHistory([])
	}, [])

	return (
		<ToolsLayout currentPath="/briar-display/tools/json">
			<Card className="flex min-h-0 flex-1 flex-col">
				<CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
					<div className="flex items-center gap-3">
						<CardTitle className="flex items-center gap-2 text-lg">
							<Braces className="h-5 w-5" />
							JSON 格式化
						</CardTitle>
					</div>
					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm" onClick={handleFileUpload} className="gap-1.5">
							<FileUp className="h-4 w-4" />
							上传文件
						</Button>
						<Button variant="outline" size="sm" onClick={handleClear} className="gap-1.5">
							<RotateCcw className="h-4 w-4" />
							清空
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
													{formatFullTime(entry.timestamp)} · {formatSize(entry.input)}
												</span>
												{(entry.tags ?? []).length > 0 && (
													<div className="mt-1 flex flex-wrap gap-1">
														{(entry.tags ?? []).map((tag) => (
															<span
																key={tag}
																className={
																	tag === '非法'
																		? 'rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700'
																		: tag === '对象'
																			? 'rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700'
																			: tag === 'JSON'
																				? 'rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700'
																				: 'rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600'
																}
															>
																{tag}
															</span>
														))}
													</div>
												)}
											</div>
										))
									)}
								</div>
							</div>
						)}

						{/* 主内容区 */}
						<div className="flex min-h-0 flex-1 flex-col space-y-4">
							{/* 操作按钮 */}
							<div className="flex flex-wrap gap-2">
								{ACTIONS.map((action) => {
									// 已是 JSON 对象时隐藏「转 JSON」，已是对象字面量时隐藏「转对象」
									if (action.key === 'toJson' && isObjectInput) return null
									if (action.key === 'toObject' && objLiteral) return null
									return (
										<Button
											key={action.key}
											size="sm"
											variant="secondary"
											onClick={() => handleAction(action.key)}
											disabled={!input.trim()}
											className="gap-1.5"
										>
											{action.icon}
											{action.label}
										</Button>
									)
								})}
							</div>

							{/* 输入 + 树状预览 */}
							<div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
								<div
									onDrop={handleDrop}
									onDragOver={(e) => e.preventDefault()}
									className="flex min-h-0 flex-col space-y-2"
								>
									<div className="flex items-center justify-between text-sm text-muted-foreground">
										<span>输入 JSON</span>
										<div className="flex items-center gap-1">
											<span className="text-xs">支持拖拽 JSON 文件</span>
											{input && (
												<Button
													variant="ghost"
													size="sm"
													onClick={handleCopy}
													className="h-auto gap-1 px-2 py-1 text-xs"
												>
													{copied ? (
														<Check className="h-3 w-3 text-green-600" />
													) : (
														<Copy className="h-3 w-3" />
													)}
													{copied ? '已复制' : '复制'}
												</Button>
											)}
										</div>
									</div>
									<Textarea
										ref={inputRef}
										value={input}
										onChange={(e) => setInput(e.target.value)}
										placeholder='粘贴 JSON 文本，例如：{"name":"Briar","value":123}'
										className="min-h-0 flex-1 resize-none font-mono text-sm"
									/>
								</div>

								<div className="flex min-h-0 flex-col space-y-2">
									<div className="flex items-center justify-between text-sm text-muted-foreground">
										<span>树状预览</span>
										<div className="flex items-center gap-1">
											{error && <span className="text-xs text-destructive">解析失败</span>}
											{input && (
												<>
													<Button
														variant="ghost"
														size="sm"
														onClick={handleExpandAll}
														className="h-auto gap-1 px-2 py-1 text-xs"
													>
														展开全部
													</Button>
													<Button
														variant="ghost"
														size="sm"
														onClick={handleCollapseAll}
														className="h-auto gap-1 px-2 py-1 text-xs"
													>
														收起全部
													</Button>
													<Button
														variant="ghost"
														size="sm"
														onClick={handleDownload}
														className="h-auto gap-1 px-2 py-1 text-xs"
													>
														<Download className="h-3 w-3" />
														下载
													</Button>
												</>
											)}
										</div>
									</div>
									{parsedValue ? (
										<div className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted/30 p-4">
											<Suspense
												fallback={<div className="text-sm text-muted-foreground">加载中...</div>}
											>
												<ReactJson
													key={treeKey}
													src={parsedValue as Record<string, unknown>}
													theme="rjv-default"
													collapseStringsAfterLength={80}
													indentWidth={2}
													collapsed={treeCollapsed}
													enableClipboard={false}
													displayDataTypes={false}
													displayObjectSize={false}
												/>
											</Suspense>
										</div>
									) : (
										<div className="flex min-h-0 flex-1 items-center justify-center rounded-md border bg-muted/10 text-sm text-muted-foreground">
											{input ? 'JSON 解析失败，请检查输入' : '输入 JSON 后此处显示树状预览'}
										</div>
									)}
								</div>
							</div>

							{/* 错误提示 */}
							{error && (
								<div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
									{error}
								</div>
							)}
						</div>
					</div>
				</CardContent>
			</Card>
		</ToolsLayout>
	)
}
