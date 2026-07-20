'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Braces, Check, Copy, Download, FileUp, RotateCcw } from 'lucide-react'
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import JsonHistorySidebar from './JsonHistorySidebar'
import JsonSearchDropdown from './JsonSearchDropdown'
import ToolsLayout from './ToolsLayout'
import {
	ACTIONS,
	type ActionKey,
	type FlatJsonEntry,
	type HistoryEntry,
	computeTags,
	executeAction,
	flattenJsonObject,
	isObjectLiteral,
	loadHistory,
	parseForPreview,
	parsePathToNamespace,
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
	const [targetPath, setTargetPath] = useState<(string | number)[] | null>(null)
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

	// DEBUG: 监听 treeKey 和 treeCollapsed 变化
	useEffect(() => {
		console.log('[DEBUG] Tree render:', { treeKey, treeCollapsed, targetPath })
	}, [treeKey, treeCollapsed, targetPath])

	const flatEntries = useMemo<FlatJsonEntry[]>(
		() => (parsedValue ? flattenJsonObject(parsedValue) : []),
		[parsedValue],
	)

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
		console.log('[DEBUG] Expand All clicked', { treeKey, treeCollapsed })
		setTreeCollapsed(false)
		setTreeKey((k) => k + 1)
	}, [treeKey, treeCollapsed])

	const handleCollapseAll = useCallback(() => {
		console.log('[DEBUG] Collapse All clicked', { treeKey, treeCollapsed })
		setTreeCollapsed(true)
		setTreeKey((k) => k + 1)
	}, [treeKey, treeCollapsed])

	const handleSelectSearchResult = useCallback((entry: FlatJsonEntry) => {
		const ns = parsePathToNamespace(entry.path)
		setTargetPath(ns)
		setTreeKey((k) => k + 1)
		// 等 DOM 渲染后定位并高亮
		requestAnimationFrame(() => {
			setTimeout(() => {
				const treeContainer = document.querySelector('.json-tree-container')
				if (!treeContainer) return
				const spans = treeContainer.querySelectorAll('span')
				const targetValue = entry.value
				const targetKey = entry.key
				for (const span of spans) {
					const text = span.textContent?.trim()
					if (text === `"${targetValue}"` || text === targetValue || text === `${targetValue},`) {
						span.scrollIntoView({ behavior: 'smooth', block: 'center' })
						span.style.backgroundColor = '#fde047'
						span.style.transition = 'background-color 0.5s ease-out'
						setTimeout(() => {
							span.style.backgroundColor = 'transparent'
							setTimeout(() => {
								span.style.transition = ''
								span.style.backgroundColor = ''
							}, 600)
						}, 1500)
						return
					}
				}
				for (const span of spans) {
					const text = span.textContent?.trim()
					if (text === `"${targetKey}"` || text === targetKey || text === `${targetKey}:`) {
						span.scrollIntoView({ behavior: 'smooth', block: 'center' })
						span.style.backgroundColor = '#fde047'
						span.style.transition = 'background-color 0.5s ease-out'
						setTimeout(() => {
							span.style.backgroundColor = 'transparent'
							setTimeout(() => {
								span.style.transition = ''
								span.style.backgroundColor = ''
							}, 600)
						}, 1500)
						return
					}
				}
				// 高亮结束后清除目标路径，恢复正常折叠状态
				setTimeout(() => {
					setTargetPath(null)
					setTreeKey((k) => k + 1)
				}, 2500)
			}, 300)
		})
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
						<JsonHistorySidebar
							collapsed={sidebarCollapsed}
							onToggle={() => setSidebarCollapsed((v) => !v)}
							entries={history}
							onRestore={handleRestore}
							onDelete={handleDeleteHistory}
							onClear={handleClearHistory}
							now={now}
						/>

						{/* 主内容区 */}
						<div className="flex min-h-0 flex-1 flex-col space-y-4">
							{/* 操作按钮 */}
							<div className="flex flex-wrap gap-2">
								{ACTIONS.map((action) => {
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
													<JsonSearchDropdown
														flatEntries={flatEntries}
														onSelect={handleSelectSearchResult}
													/>
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
										<div className="json-tree-container min-h-0 flex-1 overflow-auto rounded-md border bg-muted/30 p-4">
											<Suspense
												fallback={<div className="text-sm text-muted-foreground">加载中...</div>}
											>
												<ReactJson
													key={treeKey}
													src={parsedValue as Record<string, unknown>}
													name={false}
													theme="rjv-default"
													collapseStringsAfterLength={80}
													indentWidth={2}
													collapsed={targetPath ? false : treeCollapsed}
													shouldCollapse={
														targetPath
															? (field) => {
																	const ns = field.namespace as (string | number)[]
																	if (ns.length <= 1) return false
																	for (let i = 1; i < ns.length; i++) {
																		const pathIndex = i - 1
																		if (pathIndex >= targetPath.length) return true
																		const t = targetPath[pathIndex]
																		const n = ns[i]
																		if (String(n) !== String(t)) return true
																	}
																	return false
																}
															: undefined
													}
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
