'use client'

import { wikiApi } from '@/api/wiki'
import WikiBreadcrumbs from '@/components/wiki/common/WikiBreadcrumbs'
import { cn } from '@/lib/utils'
import type { WikiCategoryTreeNode } from '@briar/shared'
import {
	ChevronDown,
	ChevronRight,
	Eye,
	FileText,
	Loader2,
	Minus,
	Plus,
	Redo,
	Save,
	Type,
	Undo,
	X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

type EditMode = 'visual' | 'source'

function navigateTo(href: string) {
	window.history.pushState({}, '', href)
	window.dispatchEvent(new PopStateEvent('popstate'))
	window.scrollTo(0, 0)
}

// Inline TipTap-like editor using contentEditable
function VisualEditor({
	content,
	onChange,
}: {
	content: string
	onChange: (html: string) => void
}) {
	const editorRef = useRef<HTMLDivElement>(null)
	const isInternalChange = useRef(false)

	useEffect(() => {
		if (editorRef.current && !isInternalChange.current) {
			editorRef.current.innerHTML = content
		}
		isInternalChange.current = false
	}, [content])

	const execCommand = (command: string, value?: string) => {
		document.execCommand(command, false, value)
		editorRef.current?.focus()
	}

	const handleInput = () => {
		if (editorRef.current) {
			isInternalChange.current = true
			onChange(editorRef.current.innerHTML)
		}
	}

	return (
		<div className="overflow-hidden rounded-md border border-input">
			{/* Toolbar */}
			<div className="flex flex-wrap items-center gap-0.5 border-b border-input bg-muted/50 px-2 py-1.5">
				<button
					type="button"
					onClick={() => execCommand('bold')}
					className="rounded px-2 py-1 text-sm font-bold transition-colors hover:bg-muted"
					title="粗体"
				>
					B
				</button>
				<button
					type="button"
					onClick={() => execCommand('italic')}
					className="rounded px-2 py-1 text-sm italic transition-colors hover:bg-muted"
					title="斜体"
				>
					I
				</button>
				<button
					type="button"
					onClick={() => execCommand('underline')}
					className="rounded px-2 py-1 text-sm underline transition-colors hover:bg-muted"
					title="下划线"
				>
					U
				</button>
				<div className="mx-1 h-5 w-px bg-border" />
				<button
					type="button"
					onClick={() => execCommand('formatBlock', 'h2')}
					className="rounded px-2 py-1 text-sm transition-colors hover:bg-muted"
					title="标题"
				>
					H2
				</button>
				<button
					type="button"
					onClick={() => execCommand('formatBlock', 'h3')}
					className="rounded px-2 py-1 text-sm transition-colors hover:bg-muted"
					title="子标题"
				>
					H3
				</button>
				<div className="mx-1 h-5 w-px bg-border" />
				<button
					type="button"
					onClick={() => execCommand('insertUnorderedList')}
					className="rounded px-2 py-1 text-sm transition-colors hover:bg-muted"
					title="无序列表"
				>
					•
				</button>
				<button
					type="button"
					onClick={() => execCommand('insertOrderedList')}
					className="rounded px-2 py-1 text-sm transition-colors hover:bg-muted"
					title="有序列表"
				>
					1.
				</button>
				<div className="mx-1 h-5 w-px bg-border" />
				<button
					type="button"
					onClick={() => {
						const url = prompt('请输入链接地址:')
						if (url) execCommand('createLink', url)
					}}
					className="rounded px-2 py-1 text-sm transition-colors hover:bg-muted"
					title="插入链接"
				>
					🔗
				</button>
				<button
					type="button"
					onClick={() => execCommand('formatBlock', 'blockquote')}
					className="rounded px-2 py-1 text-sm transition-colors hover:bg-muted"
					title="引用"
				>
					❝
				</button>
				<div className="mx-1 h-5 w-px bg-border" />
				<button
					type="button"
					onClick={() => execCommand('undo')}
					className="rounded p-1 transition-colors hover:bg-muted"
					title="撤销"
				>
					<Undo className="h-4 w-4" />
				</button>
				<button
					type="button"
					onClick={() => execCommand('redo')}
					className="rounded p-1 transition-colors hover:bg-muted"
					title="重做"
				>
					<Redo className="h-4 w-4" />
				</button>
			</div>
			{/* Editor */}
			<div
				ref={editorRef}
				contentEditable
				onInput={handleInput}
				className="prose prose-sm min-h-[300px] max-w-none p-4 focus:outline-none"
				suppressContentEditableWarning
			/>
		</div>
	)
}

function CategorySelector({
	selected,
	onChange,
}: {
	selected: string[]
	onChange: (ids: string[]) => void
}) {
	const [tree, setTree] = useState<WikiCategoryTreeNode[]>([])
	const [expanded, setExpanded] = useState<Set<string>>(new Set())
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		const fetchTree = async () => {
			const res = await wikiApi.getCategoryTree()
			if (res.success && res.data) {
				setTree(res.data)
				// Expand all top-level by default
				setExpanded(new Set(res.data.map((c) => c.id)))
			}
			setLoading(false)
		}
		fetchTree()
	}, [])

	const toggleExpand = (id: string) => {
		setExpanded((prev) => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	const toggleSelect = (id: string) => {
		if (selected.includes(id)) {
			onChange(selected.filter((s) => s !== id))
		} else {
			onChange([...selected, id])
		}
	}

	const renderNode = (node: WikiCategoryTreeNode, depth = 0) => {
		const hasChildren = node.children.length > 0
		const isExpanded = expanded.has(node.id)
		const isSelected = selected.includes(node.id)

		return (
			<div key={node.id}>
				<div
					className={cn(
						'flex items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors hover:bg-muted',
						isSelected && 'bg-primary/10',
					)}
					style={{ paddingLeft: `${depth * 20 + 8}px` }}
				>
					{hasChildren ? (
						<button
							type="button"
							onClick={() => toggleExpand(node.id)}
							className="flex-shrink-0 p-0.5"
						>
							{isExpanded ? (
								<ChevronDown className="h-3.5 w-3.5" />
							) : (
								<ChevronRight className="h-3.5 w-3.5" />
							)}
						</button>
					) : (
						<span className="w-5" />
					)}
					<label className="flex flex-1 cursor-pointer items-center gap-2">
						<input
							type="checkbox"
							checked={isSelected}
							onChange={() => toggleSelect(node.id)}
							className="h-3.5 w-3.5 rounded border-input"
						/>
						<span>{node.name}</span>
						{node.pageCount > 0 && (
							<span className="text-muted-foreground">({node.pageCount})</span>
						)}
					</label>
				</div>
				{hasChildren && isExpanded && (
					<div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
				)}
			</div>
		)
	}

	if (loading) {
		return (
			<div className="flex items-center gap-2 py-2 text-muted-foreground text-sm">
				<Loader2 className="h-4 w-4 animate-spin" />
				加载分类...
			</div>
		)
	}

	if (tree.length === 0) {
		return <p className="py-2 text-muted-foreground text-sm">暂无分类</p>
	}

	return (
		<div className="max-h-[200px] overflow-y-auto rounded-md border border-input">
			<div className="p-1">{tree.map((node) => renderNode(node))}</div>
		</div>
	)
}

export default function WikiNewPage() {
	const [title, setTitle] = useState('')
	const [content, setContent] = useState('')
	const [editMode, setEditMode] = useState<EditMode>('visual')
	const [categoryIds, setCategoryIds] = useState<string[]>([])
	const [editSummary, setEditSummary] = useState('')
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Read ?title= from URL
	useEffect(() => {
		const params = new URLSearchParams(window.location.search)
		const titleParam = params.get('title')
		if (titleParam) {
			setTitle(decodeURIComponent(titleParam))
		}
	}, [])

	const handleSave = useCallback(async () => {
		if (!title.trim()) {
			setError('请输入文章标题')
			return
		}

		setSaving(true)
		setError(null)

		const payload = {
			title: title.trim(),
			content,
			...(categoryIds.length > 0 && { categoryIds }),
		}

		const res = await wikiApi.createPage(payload)

		if (res.success && res.data) {
			navigateTo(`/briar-display/wiki/${res.data.slug}`)
		} else {
			setError(res.message || '创建失败，请重试')
			setSaving(false)
		}
	}, [title, content, categoryIds])

	return (
		<div className="space-y-4">
			<WikiBreadcrumbs items={[{ label: '新建文章' }]} />

			<div className="flex items-center justify-between">
				<h2 className="flex items-center gap-2 font-serif text-xl font-normal text-foreground">
					<FileText className="h-5 w-5" />
					新建文章
				</h2>
				<button
					type="button"
					onClick={() => navigateTo('/briar-display/wiki/')}
					className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
				>
					<X className="h-4 w-4" />
					取消
				</button>
			</div>

			{error && (
				<div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
					{error}
				</div>
			)}

			{/* Title */}
			<div className="space-y-1.5">
				<label htmlFor="wiki-title" className="font-medium text-sm">
					文章标题 <span className="text-red-500">*</span>
				</label>
				<input
					id="wiki-title"
					type="text"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					placeholder="输入文章标题..."
					className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
				/>
			</div>

			{/* Edit mode toggle */}
			<div className="space-y-1.5">
				<div className="flex items-center justify-between">
					<label className="font-medium text-sm">文章内容</label>
					<div className="inline-flex rounded-md border border-input">
						<button
							type="button"
							onClick={() => setEditMode('visual')}
							className={cn(
								'inline-flex items-center gap-1.5 rounded-l-md px-3 py-1 text-xs transition-colors',
								editMode === 'visual'
									? 'bg-primary text-primary-foreground'
									: 'bg-background text-muted-foreground hover:bg-muted',
							)}
						>
							<Type className="h-3 w-3" />
							可视化
						</button>
						<button
							type="button"
							onClick={() => setEditMode('source')}
							className={cn(
								'inline-flex items-center gap-1.5 rounded-r-md px-3 py-1 text-xs transition-colors',
								editMode === 'source'
									? 'bg-primary text-primary-foreground'
									: 'bg-background text-muted-foreground hover:bg-muted',
							)}
						>
							&lt;/&gt; 源码
						</button>
					</div>
				</div>

				{editMode === 'visual' ? (
					<VisualEditor content={content} onChange={setContent} />
				) : (
					<div className="space-y-2">
						<textarea
							value={content}
							onChange={(e) => setContent(e.target.value)}
							placeholder="输入文章内容（支持 HTML）..."
							rows={15}
							className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
						/>
						{content && (
							<div className="space-y-1">
								<p className="flex items-center gap-1 text-muted-foreground text-xs">
									<Eye className="h-3 w-3" />
									预览
								</p>
								<div
									className="prose prose-sm max-h-[200px] max-w-none overflow-y-auto rounded-md border border-dashed border-input p-4"
									// biome-ignore lint/security/noDangerouslySetInnerHtml: preview purpose
									dangerouslySetInnerHTML={{ __html: content }}
								/>
							</div>
						)}
					</div>
				)}
			</div>

			{/* Categories */}
			<div className="space-y-1.5">
				<label className="font-medium text-sm">分类</label>
				<CategorySelector selected={categoryIds} onChange={setCategoryIds} />
			</div>

			{/* Edit summary */}
			<div className="space-y-1.5">
				<label htmlFor="wiki-summary" className="font-medium text-sm">
					编辑摘要
				</label>
				<input
					id="wiki-summary"
					type="text"
					value={editSummary}
					onChange={(e) => setEditSummary(e.target.value)}
					placeholder="简要描述你的编辑内容..."
					className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
				/>
			</div>

			{/* Actions */}
			<div className="flex items-center gap-3 border-t border-border pt-4">
				<button
					type="button"
					onClick={handleSave}
					disabled={saving || !title.trim()}
					className={cn(
						'inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm transition-colors hover:bg-primary/90',
						(saving || !title.trim()) && 'cursor-not-allowed opacity-50',
					)}
				>
					{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
					{saving ? '保存中...' : '保存文章'}
				</button>
				<button
					type="button"
					onClick={() => navigateTo('/briar-display/wiki/')}
					className="rounded-md px-4 py-2 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
				>
					取消
				</button>
			</div>
		</div>
	)
}
