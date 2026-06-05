'use client'

import { wikiApi } from '@/api/wiki'
import TagInput from '@/components/wiki/common/TagInput'
import WikiBreadcrumbs from '@/components/wiki/common/WikiBreadcrumbs'
import WikiTabs from '@/components/wiki/layout/WikiTabs'
import { cn } from '@/lib/utils'
import type { WikiCategoryTreeNode, WikiPage, WikiPageVisibility } from '@briar/shared'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
	Bold,
	ChevronDown,
	ChevronRight,
	Code,
	Heading2,
	Heading3,
	Heading4,
	ImageIcon,
	Italic,
	Link2,
	List,
	ListOrdered,
	Loader2,
	Quote,
	Redo,
	Tag,
	Undo,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'

interface WikiEditPageProps {
	slug: string
}

type EditMode = 'visual' | 'source'

/** Toolbar button component */
function ToolbarButton({
	icon: Icon,
	label,
	isActive = false,
	disabled = false,
	onClick,
}: {
	icon: React.ElementType
	label: string
	isActive?: boolean
	disabled?: boolean
	onClick: () => void
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			title={label}
			className={cn(
				'inline-flex h-8 w-8 items-center justify-center rounded-sm transition-colors',
				isActive ? 'bg-wiki-link text-white' : 'text-wiki-text hover:bg-wiki-bg-tertiary',
				disabled && 'cursor-not-allowed opacity-50',
			)}
		>
			<Icon className="h-4 w-4" />
		</button>
	)
}

function ToolbarSeparator() {
	return <div className="mx-1 h-6 w-px bg-wiki-border-light" />
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
						'flex items-center gap-1 rounded-sm px-2 py-1 text-[13px] transition-colors hover:bg-wiki-bg-tertiary',
						isSelected && 'bg-wiki-link/10',
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
							className="h-3.5 w-3.5 rounded-sm border-wiki-border"
						/>
						<span>{node.name}</span>
						{node.pageCount > 0 && <span className="text-wiki-text-muted">({node.pageCount})</span>}
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
			<div className="flex items-center gap-2 py-2 text-[13px] text-wiki-text-muted">
				<Loader2 className="h-4 w-4 animate-spin" />
				加载分类...
			</div>
		)
	}

	if (tree.length === 0) {
		return <p className="py-2 text-[13px] text-wiki-text-muted">暂无分类</p>
	}

	return (
		<div className="max-h-[200px] overflow-y-auto rounded-sm border border-wiki-border-light">
			<div className="p-1">{tree.map((node) => renderNode(node))}</div>
		</div>
	)
}

export default function WikiEditPage({ slug }: WikiEditPageProps) {
	const isNew = slug === 'new' || slug === ''
	const [mode, setMode] = useState<EditMode>('visual')
	const [title, setTitle] = useState('')
	const [sourceContent, setSourceContent] = useState('')
	const [editSummary, setEditSummary] = useState('')
	const [loading, setLoading] = useState(!isNew)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [existingPage, setExistingPage] = useState<WikiPage | null>(null)
	const [visibility, setVisibility] = useState<WikiPageVisibility>('public')
	const [tags, setTags] = useState<string[]>([])
	const [categoryIds, setCategoryIds] = useState<string[]>([])
	const [lastReadAt, setLastReadAt] = useState<string>('')

	// TipTap editor
	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				codeBlock: false,
			}),
			Underline,
			Highlight.configure({ multicolor: false }),
			Link.configure({
				openOnClick: false,
				HTMLAttributes: { class: 'text-wiki-link hover:underline cursor-pointer' },
			}),
			Image.configure({
				HTMLAttributes: { class: 'max-w-full h-auto rounded-sm' },
			}),
			Placeholder.configure({
				placeholder: '开始编写文章内容...',
			}),
		],
		content: '',
		editorProps: {
			attributes: {
				class: 'prose prose-wiki max-w-none focus:outline-none min-h-[400px] p-4',
			},
		},
	})

	// Load existing page content
	useEffect(() => {
		if (isNew || !editor) return

		let cancelled = false
		setLoading(true)

		wikiApi.getPageDetails(slug).then((res) => {
			if (cancelled) return
			if (res.success && res.data) {
				const page = res.data
				setExistingPage(page)
				setTitle(page.title)
				setSourceContent(page.content)
				setVisibility(page.visibility || 'public')
				setLastReadAt(page.updatedAt)
				editor.commands.setContent(page.content)

				// Set tags
				if (page.tags && page.tags.length > 0) {
					setTags(page.tags.map((t: any) => t.name))
				}

				// Set categories
				if (page.categories && page.categories.length > 0) {
					setCategoryIds(page.categories.map((c: any) => c.id))
				}
			} else {
				setError(res.message || '加载文章失败')
			}
			setLoading(false)
		})

		return () => {
			cancelled = true
		}
	}, [slug, isNew, editor])

	/**
	 * Get markdown from TipTap editor.
	 */
	const getEditorMarkdown = useCallback((): string => {
		if (!editor) return ''
		// @ts-expect-error markdown extension storage may not be typed
		if (editor.storage?.markdown?.getMarkdown) {
			// @ts-expect-error markdown extension storage may not be typed
			return editor.storage.markdown.getMarkdown()
		}
		const html = editor.getHTML()
		return html
			.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
			.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
			.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
			.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n')
			.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
			.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
			.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
			.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
			.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
			.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n')
			.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
			.replace(/<br\s*\/?>/gi, '\n')
			.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
			.replace(/<[^>]+>/g, '')
			.replace(/&nbsp;/g, ' ')
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/\n{3,}/g, '\n\n')
			.trim()
	}, [editor])

	// Sync content when switching modes
	const handleModeChange = useCallback(
		(newMode: EditMode) => {
			if (newMode === 'source' && editor) {
				const md = getEditorMarkdown()
				setSourceContent(md)
			} else if (newMode === 'visual' && editor) {
				editor.commands.setContent(sourceContent)
			}
			setMode(newMode)
		},
		[editor, sourceContent, getEditorMarkdown],
	)

	// Save handler
	const handleSave = useCallback(async () => {
		if (!title.trim()) {
			setError('请输入文章标题')
			return
		}

		setSaving(true)
		setError(null)

		const content =
			mode === 'visual' && editor ? getEditorMarkdown() || editor.getHTML() : sourceContent

		try {
			if (isNew) {
				const res = await wikiApi.createPage({
					title: title.trim(),
					content,
					visibility,
					tagNames: tags,
					categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
				})
				if (res.success && res.data) {
					window.history.pushState({}, '', `/briar-display/wiki/${res.data.slug}`)
					window.dispatchEvent(new PopStateEvent('popstate'))
				} else {
					setError(res.message || '创建失败')
				}
			} else {
				const payload: any = {
					title: title.trim(),
					content,
					visibility,
					tagNames: tags,
					categoryIds,
					editSummary: editSummary.trim() || undefined,
				}

				// Optimistic locking
				if (lastReadAt) {
					payload.lastReadAt = lastReadAt
				}

				const res = await wikiApi.updatePage(slug, payload)
				if (res.success && res.data) {
					window.history.pushState({}, '', `/briar-display/wiki/${res.data.slug}`)
					window.dispatchEvent(new PopStateEvent('popstate'))
				} else {
					setError(res.message || '保存失败')
				}
			}
		} catch (err: any) {
			if (err?.response?.status === 409) {
				setError('编辑冲突：此页面在你编辑期间已被修改，请刷新后重试')
			} else {
				setError('保存时发生错误')
			}
		} finally {
			setSaving(false)
		}
	}, [
		title,
		mode,
		editor,
		sourceContent,
		editSummary,
		isNew,
		slug,
		getEditorMarkdown,
		visibility,
		tags,
		categoryIds,
		lastReadAt,
	])

	// Cancel handler
	const handleCancel = useCallback(() => {
		if (isNew) {
			window.history.pushState({}, '', '/briar-display/wiki/')
		} else {
			window.history.pushState({}, '', `/briar-display/wiki/${slug}`)
		}
		window.dispatchEvent(new PopStateEvent('popstate'))
	}, [isNew, slug])

	// TipTap toolbar actions
	const addLink = useCallback(() => {
		if (!editor) return
		const url = window.prompt('输入链接 URL:')
		if (url) {
			editor.chain().focus().setLink({ href: url }).run()
		}
	}, [editor])

	const addImage = useCallback(() => {
		if (!editor) return
		const url = window.prompt('输入图片 URL:')
		if (url) {
			editor.chain().focus().setImage({ src: url }).run()
		}
	}, [editor])

	if (loading) {
		return (
			<div className="space-y-4">
				<WikiBreadcrumbs items={[{ label: isNew ? '新建文章' : '编辑文章' }]} />
				<WikiTabs slug={slug} active="edit" />
				<div className="flex items-center justify-center py-20">
					<Loader2 className="h-8 w-8 animate-spin text-wiki-text-muted" />
					<span className="ml-2 text-wiki-text-muted">加载中...</span>
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-4">
			<WikiBreadcrumbs
				items={[
					{ label: existingPage?.title || slug, href: `/briar-display/wiki/${slug}` },
					{ label: isNew ? '新建' : '编辑' },
				]}
			/>
			<WikiTabs slug={slug} active="edit" />

			<h1 className="border-b border-wiki-border-light pb-2 text-[1.5em] font-normal text-wiki-text">
				{isNew ? '新建文章' : `编辑: ${existingPage?.title || slug}`}
			</h1>

			{error && (
				<div className="rounded-sm border border-wiki-highlight bg-wiki-highlight px-4 py-3 text-[13px] text-wiki-link-red">
					{error}
				</div>
			)}

			{/* Title input */}
			<div>
				<label htmlFor="wiki-title" className="mb-1 block text-[13px] font-medium text-wiki-text">
					标题
				</label>
				<input
					id="wiki-title"
					type="text"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					placeholder="输入文章标题"
					className="w-full rounded-sm border border-wiki-border bg-wiki-bg px-3 py-2 text-[14px] text-wiki-text placeholder:text-wiki-text-muted focus:border-wiki-link focus:outline-none focus:ring-1 focus:ring-wiki-link"
				/>
			</div>

			{/* Visibility */}
			<div>
				<label className="mb-1 block text-[13px] font-medium text-wiki-text">可见性</label>
				<div className="flex gap-3">
					<label className="flex items-center gap-1.5 text-[13px] text-wiki-text">
						<input
							type="radio"
							name="visibility"
							value="public"
							checked={visibility === 'public'}
							onChange={() => setVisibility('public')}
							className="h-4 w-4 border-wiki-border text-wiki-link focus:ring-wiki-link"
						/>
						公开
					</label>
					<label className="flex items-center gap-1.5 text-[13px] text-wiki-text">
						<input
							type="radio"
							name="visibility"
							value="private"
							checked={visibility === 'private'}
							onChange={() => setVisibility('private')}
							className="h-4 w-4 border-wiki-border text-wiki-link focus:ring-wiki-link"
						/>
						私密（仅自己可见）
					</label>
					<label className="flex items-center gap-1.5 text-[13px] text-wiki-text">
						<input
							type="radio"
							name="visibility"
							value="link_only"
							checked={visibility === 'link_only'}
							onChange={() => setVisibility('link_only')}
							className="h-4 w-4 border-wiki-border text-wiki-link focus:ring-wiki-link"
						/>
						仅链接
					</label>
				</div>
			</div>

			{/* Tags */}
			<div>
				<label className="mb-1 block text-[13px] font-medium text-wiki-text">
					<Tag className="mr-1 inline-block h-3.5 w-3.5" />
					标签
				</label>
				<TagInput value={tags} onChange={setTags} />
				<p className="mt-1 text-[11px] text-wiki-text-muted">
					回车或逗号添加标签，输入时显示已有标签建议
				</p>
			</div>
			{/* Categories */}
			<div>
				<label className="mb-1 block text-[13px] font-medium text-wiki-text">分类</label>
				<CategorySelector selected={categoryIds} onChange={setCategoryIds} />
			</div>

			{/* Mode toggle */}
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={() => handleModeChange('visual')}
					className={cn(
						'reounded-sm px-3 py-1.5 text-[13px] transition-colors',
						mode === 'visual'
							? 'bg-wiki-link text-white'
							: 'border border-wiki-border-light text-wiki-text hover:bg-wiki-bg-secondary',
					)}
				>
					可视化
				</button>
				<button
					type="button"
					onClick={() => handleModeChange('source')}
					className={cn(
						'reounded-sm px-3 py-1.5 text-[13px] transition-colors',
						mode === 'source'
							? 'bg-wiki-link text-white'
							: 'border border-wiki-border-light text-wiki-text hover:bg-wiki-bg-secondary',
					)}
				>
					源码
				</button>
			</div>

			{/* Visual editor mode */}
			{mode === 'visual' && editor && (
				<div className="overflow-hidden rounded-sm border border-wiki-border-light">
					{/* Toolbar */}
					<div className="flex flex-wrap items-center gap-0.5 border-b border-wiki-border-light bg-wiki-bg-secondary px-2 py-1.5">
						<ToolbarButton
							icon={Bold}
							label="加粗"
							isActive={editor.isActive('bold')}
							onClick={() => editor.chain().focus().toggleBold().run()}
						/>
						<ToolbarButton
							icon={Italic}
							label="斜体"
							isActive={editor.isActive('italic')}
							onClick={() => editor.chain().focus().toggleItalic().run()}
						/>

						<ToolbarSeparator />

						<ToolbarButton
							icon={Heading2}
							label="标题 2"
							isActive={editor.isActive('heading', { level: 2 })}
							onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
						/>
						<ToolbarButton
							icon={Heading3}
							label="标题 3"
							isActive={editor.isActive('heading', { level: 3 })}
							onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
						/>
						<ToolbarButton
							icon={Heading4}
							label="标题 4"
							isActive={editor.isActive('heading', { level: 4 })}
							onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
						/>

						<ToolbarSeparator />

						<ToolbarButton
							icon={List}
							label="无序列表"
							isActive={editor.isActive('bulletList')}
							onClick={() => editor.chain().focus().toggleBulletList().run()}
						/>
						<ToolbarButton
							icon={ListOrdered}
							label="有序列表"
							isActive={editor.isActive('orderedList')}
							onClick={() => editor.chain().focus().toggleOrderedList().run()}
						/>

						<ToolbarSeparator />

						<ToolbarButton icon={Link2} label="插入链接" onClick={addLink} />
						<ToolbarButton
							icon={Code}
							label="代码块"
							isActive={editor.isActive('codeBlock')}
							onClick={() => editor.chain().focus().toggleCodeBlock().run()}
						/>
						<ToolbarButton
							icon={Quote}
							label="引用"
							isActive={editor.isActive('blockquote')}
							onClick={() => editor.chain().focus().toggleBlockquote().run()}
						/>
						<ToolbarButton icon={ImageIcon} label="插入图片" onClick={addImage} />

						<div className="flex-1" />

						<ToolbarButton
							icon={Undo}
							label="撤销"
							disabled={!editor.can().undo()}
							onClick={() => editor.chain().focus().undo().run()}
						/>
						<ToolbarButton
							icon={Redo}
							label="重做"
							disabled={!editor.can().redo()}
							onClick={() => editor.chain().focus().redo().run()}
						/>
					</div>

					{/* Editor content */}
					<EditorContent editor={editor} />
				</div>
			)}

			{/* Source editor mode */}
			{mode === 'source' && (
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					{/* Textarea */}
					<div>
						<label className="mb-1 block text-[13px] font-medium text-wiki-text">源码</label>
						<textarea
							value={sourceContent}
							onChange={(e) => setSourceContent(e.target.value)}
							placeholder="输入 Markdown 源码..."
							className="h-[500px] w-full resize-y rounded-sm border border-wiki-border bg-wiki-bg px-3 py-2 font-mono text-[13px] text-wiki-text placeholder:text-wiki-text-muted focus:border-wiki-link focus:outline-none focus:ring-1 focus:ring-wiki-link"
						/>
					</div>

					{/* Preview */}
					<div>
						<label className="mb-1 block text-[13px] font-medium text-wiki-text">预览</label>
						<div className="h-[500px] overflow-y-auto rounded-sm border border-wiki-border-light bg-wiki-bg-secondary p-4">
							{sourceContent ? (
								<div className="prose prose-wiki max-w-none">
									<ReactMarkdown>{sourceContent}</ReactMarkdown>
								</div>
							) : (
								<p className="text-[13px] italic text-wiki-text-muted">预览区域</p>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Edit summary & controls */}
			<div className="space-y-3 rounded-sm border border-wiki-border-light bg-wiki-bg-secondary p-4">
				<div>
					<label
						htmlFor="edit-summary"
						className="mb-1 block text-[13px] font-medium text-wiki-text"
					>
						编辑摘要
					</label>
					<input
						id="edit-summary"
						type="text"
						value={editSummary}
						onChange={(e) => setEditSummary(e.target.value)}
						placeholder="简要描述你的更改（可选）"
						className="w-full rounded-sm border border-wiki-border bg-wiki-bg px-3 py-2 text-[13px] text-wiki-text placeholder:text-wiki-text-muted focus:border-wiki-link focus:outline-none focus:ring-1 focus:ring-wiki-link"
					/>
				</div>
			</div>

			{/* Action buttons */}
			<div className="flex items-center gap-3 border-t border-wiki-border-light pt-4">
				<button
					type="button"
					onClick={handleSave}
					disabled={saving}
					className={cn(
						'inline-flex items-center gap-2 rounded-sm bg-wiki-link px-5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-wiki-link-hover',
						saving && 'cursor-not-allowed opacity-70',
					)}
				>
					{saving && <Loader2 className="h-4 w-4 animate-spin" />}
					{isNew ? '创建页面' : '保存更改'}
				</button>
				<button
					type="button"
					onClick={handleCancel}
					disabled={saving}
					className="rounded-sm border border-wiki-border-light px-5 py-2 text-[13px] text-wiki-text transition-colors hover:bg-wiki-bg-secondary"
				>
					取消
				</button>
			</div>
		</div>
	)
}
