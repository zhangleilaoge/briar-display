'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { type Change, diffLines } from 'diff'
import { FileDiff, FileUp, RotateCcw, Rows3, SplitSquareHorizontal } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import ToolsLayout from './ToolsLayout'

type ViewMode = 'split' | 'unified'

interface DiffStats {
	added: number
	removed: number
	unchanged: number
}

function computeStats(changes: Change[]): DiffStats {
	let added = 0
	let removed = 0
	let unchanged = 0
	for (const c of changes) {
		const lines = c.value
			.split('\n')
			.filter((_, i, arr) => i < arr.length - 1 || arr[arr.length - 1] !== '')
		const count = c.value.endsWith('\n')
			? c.value.split('\n').length - 1
			: c.value.split('\n').length
		if (c.added) added += count
		else if (c.removed) removed += count
		else unchanged += count
	}
	return { added, removed, unchanged }
}

function UnifiedView({ changes }: { changes: Change[] }) {
	let lineNum = 0
	return (
		<pre className="overflow-x-auto rounded-md border bg-muted/30 p-4 font-mono text-sm leading-relaxed">
			{changes.map((change, ci) => {
				const lines = change.value.split('\n')
				// Remove trailing empty string from split
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
	// Build left/right line arrays
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
			{/* Left */}
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
			{/* Right */}
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

	const leftRef = useRef<HTMLTextAreaElement>(null)
	const rightRef = useRef<HTMLTextAreaElement>(null)

	const handleCompare = useCallback(() => {
		if (!leftText && !rightText) return
		const result = diffLines(leftText, rightText)
		setChanges(result)
		setStats(computeStats(result))
	}, [leftText, rightText])

	const handleClear = useCallback(() => {
		setLeftText('')
		setRightText('')
		setChanges(null)
		setStats(null)
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
		<ToolsLayout currentPath="/briar-display/tools/diff" title="文件 Diff">
			<Card>
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
				<CardContent className="space-y-4">
					{/* 编辑区 */}
					<div className="grid grid-cols-2 gap-4">
						<div
							onDrop={handleFileDrop('left')}
							onDragOver={(e) => e.preventDefault()}
							className="relative"
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
								className="h-[250px] resize-y font-mono text-sm"
							/>
						</div>
						<div
							onDrop={handleFileDrop('right')}
							onDragOver={(e) => e.preventDefault()}
							className="relative"
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
								className="h-[250px] resize-y font-mono text-sm"
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
							<Badge variant="outline">{stats.unchanged} 行未变</Badge>
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
				</CardContent>
			</Card>
		</ToolsLayout>
	)
}
