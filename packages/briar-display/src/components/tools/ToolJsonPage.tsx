'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
	Braces,
	Check,
	Copy,
	Download,
	Eraser,
	FileUp,
	Minus,
	RotateCcw,
	Shield,
	WrapText,
} from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import ToolsLayout from './ToolsLayout'

type ActionKey = 'format' | 'minify' | 'escape' | 'unescape' | 'escapeUnicode' | 'unescapeUnicode'

interface ActionDef {
	key: ActionKey
	label: string
	icon: React.ReactNode
}

const ACTIONS: ActionDef[] = [
	{ key: 'format', label: '格式化', icon: <WrapText className="h-4 w-4" /> },
	{ key: 'minify', label: '压缩', icon: <Minus className="h-4 w-4" /> },
	{ key: 'escape', label: '加转义', icon: <Shield className="h-4 w-4" /> },
	{ key: 'unescape', label: '去转义', icon: <Eraser className="h-4 w-4" /> },
	{ key: 'escapeUnicode', label: '转 Unicode', icon: <Braces className="h-4 w-4" /> },
	{ key: 'unescapeUnicode', label: '去 Unicode', icon: <Braces className="h-4 w-4" /> },
]

function tryParseJson(text: string): { value: unknown; valid: boolean; error?: string } {
	try {
		const value = JSON.parse(text)
		return { value, valid: true }
	} catch (e) {
		return { value: undefined, valid: false, error: (e as Error).message }
	}
}

function escapeJsonString(str: string): string {
	return JSON.stringify(str).slice(1, -1)
}

function unescapeJsonString(str: string): string {
	// 安全地解析 "..." 字符串，避免 eval
	try {
		return JSON.parse(`"${str}"`)
	} catch {
		return str
	}
}

function unicodeEscape(str: string): string {
	return str.replace(/[^\0-\x7f]/g, (c) => {
		const code = c.codePointAt(0) ?? 0
		return code > 0xffff ? `\\u{${code.toString(16)}}` : `\\u${code.toString(16).padStart(4, '0')}`
	})
}

function unicodeUnescape(str: string): string {
	return str.replace(/\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})/g, (_, hex1, hex2) => {
		const code = Number.parseInt(hex1 || hex2, 16)
		return String.fromCodePoint(code)
	})
}

export default function ToolJsonPage() {
	const [input, setInput] = useState('')
	const [output, setOutput] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [copied, setCopied] = useState(false)
	const inputRef = useRef<HTMLTextAreaElement>(null)

	const handleAction = useCallback(
		(key: ActionKey) => {
			setError(null)
			setCopied(false)

			if (!input.trim()) {
				setOutput('')
				return
			}

			try {
				switch (key) {
					case 'format': {
						const { value, valid, error } = tryParseJson(input)
						if (!valid) throw new Error(error)
						setOutput(JSON.stringify(value, null, 2))
						break
					}
					case 'minify': {
						const { value, valid, error } = tryParseJson(input)
						if (!valid) throw new Error(error)
						setOutput(JSON.stringify(value))
						break
					}
					case 'escape': {
						const { value, valid } = tryParseJson(input)
						if (valid) {
							// 如果是合法 JSON，先 stringify 再对结果做字符串转义
							setOutput(escapeJsonString(JSON.stringify(value)))
						} else {
							// 否则直接对文本做字符串转义
							setOutput(escapeJsonString(input))
						}
						break
					}
					case 'unescape': {
						// 尝试作为 JSON 字符串解析
						const unescaped = unescapeJsonString(input)
						// 解析结果是否还是合法 JSON
						const { value, valid } = tryParseJson(unescaped)
						setOutput(valid ? JSON.stringify(value, null, 2) : unescaped)
						break
					}
					case 'escapeUnicode': {
						const { value, valid, error } = tryParseJson(input)
						if (!valid) throw new Error(error)
						setOutput(unicodeEscape(JSON.stringify(value)))
						break
					}
					case 'unescapeUnicode': {
						const unescaped = unicodeUnescape(input)
						const { value, valid } = tryParseJson(unescaped)
						setOutput(valid ? JSON.stringify(value, null, 2) : unescaped)
						break
					}
				}
			} catch (e) {
				setError((e as Error).message)
				setOutput('')
			}
		},
		[input],
	)

	const handleClear = useCallback(() => {
		setInput('')
		setOutput('')
		setError(null)
		setCopied(false)
		inputRef.current?.focus()
	}, [])

	const handleCopy = useCallback(() => {
		if (!output) return
		navigator.clipboard.writeText(output).then(() => {
			setCopied(true)
			setTimeout(() => setCopied(false), 1500)
		})
	}, [output])

	const handleDownload = useCallback(() => {
		if (!output) return
		const blob = new Blob([output], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `formatted-${Date.now()}.json`
		a.click()
		URL.revokeObjectURL(url)
	}, [output])

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
				setOutput('')
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
			setOutput('')
			setError(null)
		}
		reader.readAsText(file)
	}, [])

	return (
		<ToolsLayout currentPath="/briar-display/tools/json">
			<Card>
				<CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
					<CardTitle className="flex items-center gap-2 text-lg">
						<Braces className="h-5 w-5" />
						JSON 格式化
					</CardTitle>
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
				<CardContent className="space-y-4">
					{/* 操作按钮 */}
					<div className="flex flex-wrap gap-2">
						{ACTIONS.map((action) => (
							<Button
								key={action.key}
								size="sm"
								variant="secondary"
								onClick={() => handleAction(action.key)}
								className="gap-1.5"
							>
								{action.icon}
								{action.label}
							</Button>
						))}
					</div>

					{/* 输入输出 */}
					<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
						<div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()} className="space-y-2">
							<div className="flex items-center justify-between text-sm text-muted-foreground">
								<span>输入 JSON</span>
								<span className="text-xs">支持拖拽 JSON 文件</span>
							</div>
							<Textarea
								ref={inputRef}
								value={input}
								onChange={(e) => setInput(e.target.value)}
								placeholder='粘贴 JSON 文本，例如：{"name":"Briar","value":123}'
								className="h-[360px] resize-y font-mono text-sm"
							/>
						</div>

						<div className="space-y-2">
							<div className="flex items-center justify-between text-sm text-muted-foreground">
								<span>处理结果</span>
								<div className="flex items-center gap-2">
									{error && <span className="text-xs text-destructive">解析失败</span>}
									{output && (
										<>
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
												已复制
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
							<Textarea
								value={output}
								readOnly
								placeholder="处理结果会显示在这里"
								className="h-[360px] resize-y font-mono text-sm"
							/>
						</div>
					</div>

					{/* 错误提示 */}
					{error && (
						<div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
							{error}
						</div>
					)}
				</CardContent>
			</Card>
		</ToolsLayout>
	)
}
