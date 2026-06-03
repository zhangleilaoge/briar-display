'use client'

import { wikiApi } from '@/api/wiki'
import WikiTabs from '@/components/wiki/layout/WikiTabs'
import { cn } from '@/lib/utils'
import type { WikiPage } from '@briar/shared'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
	Bold,
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
	Minus,
	Quote,
	Redo,
	Strikethrough,
	TableIcon,
	Trash2,
	Underline as UnderlineIcon,
	Undo,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
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
				'inline-flex h-8 w-8 items-center justify-center rounded transition-colors',
				isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
				disabled && 'cursor-not-allowed opacity-50',
			)}
		>
			<Icon className="h-4 w-4" />
		</button>
	)
}

function ToolbarSeparator() {
	return <div className="mx-1 h-6 w-px bg-border" />
}

export default function WikiEditPage({ slug }: WikiEditPageProps) {
	const isNew = slug === 'new' || slug === ''
	const [mode, setMode] = useState<EditMode>('visual')
	const [title, setTitle] = useState('')
	const [sourceContent, setSourceContent] = useState('')
	const [editSummary, setEditSummary] = useState('')
	const [minorEdit, setMinorEdit] = useState(false)
	const [loading, setLoading] = useState(!isNew)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [existingPage, setExistingPage] = useState<WikiPage | null>(null)
	const previewRef = useRef<HTMLDivElement>(null)

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
				HTMLAttributes: { class: 'text-blue-600 hover:underline cursor-pointer' },
			}),
			Image.configure({
				HTMLAttributes: { class: 'max-w-full h-auto rounded' },
			}),
			Table.configure({
				resizable: true,
			}),
			TableRow,
			TableCell,
			TableHeader,
			Placeholder.configure({
				placeholder: '开始编写文章内容...',
			}),
		],
		content: '',
		editorProps: {
			attributes: {
				class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] p-4',
			},
		},
	})

	// Load existing page content
	useEffect(() => {
		if (isNew || !editor) return

		let cancelled = false
		setLoading(true)

		wikiApi.getBySlug(slug).then((res) => {
			if (cancelled) return
			if (res.success && res.data) {
				setExistingPage(res.data)
				setTitle(res.data.title)
				setSourceContent(res.data.content)
				editor.commands.setContent(res.data.content)
			} else {
				setError(res.message || '加载文章失败')
			}
			setLoading(false)
		})

		return () => {
			cancelled = true
		}
	}, [slug, isNew, editor])

	// Sync source content when switching to source mode
	const handleModeChange = useCallback(
		(newMode: EditMode) => {
			if (newMode === 'source' && editor) {
				setSourceContent(editor.getText() ? editor.getHTML() : '')
			} else if (newMode === 'visual' && editor) {
				editor.commands.setContent(sourceContent)
			}
			setMode(newMode)
		},
		[editor, sourceContent],
	)

	// Save handler
	const handleSave = useCallback(async () => {
		if (!title.trim()) {
			setError('请输入文章标题')
			return
		}

		setSaving(true)
		setError(null)

		const content = mode === 'visual' && editor ? editor.getHTML() : sourceContent

		try {
			if (isNew) {
				const res = await wikiApi.createPage({
					title: title.trim(),
					content,
				})
				if (res.success && res.data) {
					window.history.pushState({}, '', `/briar-display/wiki/${res.data.slug}`)
					window.dispatchEvent(new PopStateEvent('popstate'))
				} else {
					setError(res.message || '创建失败')
				}
			} else {
				const res = await wikiApi.updatePage(slug, {
					title: title.trim(),
					content,
					editSummary: editSummary.trim() || undefined,
					minorEdit,
				})
				if (res.success) {
					window.history.pushState({}, '', `/briar-display/wiki/${slug}`)
					window.dispatchEvent(new PopStateEvent('popstate'))
				} else {
					setError(res.message || '保存失败')
				}
			}
		} catch {
			setError('保存时发生错误')
		} finally {
			setSaving(false)
		}
	}, [title, mode, editor, sourceContent, editSummary, minorEdit, isNew, slug])

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

	const insertTable = useCallback(() => {
		if (!editor) return
		editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
	}, [editor])

	if (loading) {
		return (
			<div className="space-y-4">
				<WikiTabs slug={slug} activeTab="edit" />
				<div className="flex items-center justify-center py-20">
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
					<span className="ml-2 text-muted-foreground">加载中...</span>
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-4">
			<WikiTabs slug={slug} activeTab="edit" />

			<h1 className="border-b border-border pb-3 font-serif text-xl font-normal text-foreground">
				{isNew ? '新建文章' : `编辑: ${existingPage?.title || slug}`}
			</h1>

			{error && (
				<div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			)}

			{/* Title input */}
			<div>
				<label htmlFor="wiki-title" className="mb-1 block text-sm font-medium text-foreground">
					标题
				</label>
				<input
					id="wiki-title"
					type="text"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					placeholder="输入文章标题"
					className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
				/>
			</div>

			{/* Mode toggle */}
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={() => handleModeChange('visual')}
					className={cn(
						'rounded-md px-3 py-1.5 text-sm transition-colors',
						mode === 'visual'
							? 'bg-primary text-primary-foreground'
							: 'border border-border text-foreground hover:bg-muted',
					)}
				>
					可视化编辑
				</button>
				<button
					type="button"
					onClick={() => handleModeChange('source')}
					className={cn(
						'rounded-md px-3 py-1.5 text-sm transition-colors',
						mode === 'source'
							? 'bg-primary text-primary-foreground'
							: 'border border-border text-foreground hover:bg-muted',
					)}
				>
					源码编辑
				</button>
			</div>

			{/* Visual editor mode */}
			{mode === 'visual' && editor && (
				<div className="overflow-hidden rounded-md border border-border">
					{/* Toolbar */}
					<div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-gray-50 px-2 py-1.5">
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
						<ToolbarButton
							icon={UnderlineIcon}
							label="下划线"
							isActive={editor.isActive('underline')}
							onClick={() => editor.chain().focus().toggleUnderline().run()}
						/>
						<ToolbarButton
							icon={Strikethrough}
							label="删除线"
							isActive={editor.isActive('strike')}
							onClick={() => editor.chain().focus().toggleStrike().run()}
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

						<ToolbarButton
							icon={Quote}
							label="引用"
							isActive={editor.isActive('blockquote')}
							onClick={() => editor.chain().focus().toggleBlockquote().run()}
						/>
						<ToolbarButton
							icon={Code}
							label="代码块"
							isActive={editor.isActive('codeBlock')}
							onClick={() => editor.chain().focus().toggleCodeBlock().run()}
						/>
						<ToolbarButton
							icon={Minus}
							label="高亮"
							isActive={editor.isActive('highlight')}
							onClick={() => editor.chain().focus().toggleHighlight().run()}
						/>

						<ToolbarSeparator />

						<ToolbarButton icon={Link2} label="插入链接" onClick={addLink} />
						<ToolbarButton icon={ImageIcon} label="插入图片" onClick={addImage} />
						<ToolbarButton icon={TableIcon} label="插入表格" onClick={insertTable} />

						<ToolbarSeparator />

						<ToolbarButton
							icon={Minus}
							label="分割线"
							onClick={() => editor.chain().focus().setHorizontalRule().run()}
						/>

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
						{editor.isActive('table') && (
							<>
								<ToolbarSeparator />
								<ToolbarButton
									icon={Trash2}
									label="删除表格"
									onClick={() => editor.chain().focus().deleteTable().run()}
								/>
							</>
						)}
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
						<label className="mb-1 block text-sm font-medium text-foreground">源码</label>
						<textarea
							value={sourceContent}
							onChange={(e) => setSourceContent(e.target.value)}
							placeholder="输入 Markdown 源码..."
							className="h-[500px] w-full resize-y rounded-md border border-border bg-white px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>

					{/* Preview */}
					<div>
						<label className="mb-1 block text-sm font-medium text-foreground">预览</label>
						<div
							ref={previewRef}
							className="h-[500px] overflow-y-auto rounded-md border border-border bg-gray-50 p-4"
						>
							{sourceContent ? (
								<div className="prose prose-sm max-w-none">
									<ReactMarkdown>{sourceContent}</ReactMarkdown>
								</div>
							) : (
								<p className="text-sm italic text-muted-foreground">预览区域</p>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Edit summary & controls */}
			<div className="space-y-3 rounded-md border border-border bg-gray-50 p-4">
				<div>
					<label htmlFor="edit-summary" className="mb-1 block text-sm font-medium text-foreground">
						编辑摘要
					</label>
					<input
						id="edit-summary"
						type="text"
						value={editSummary}
						onChange={(e) => setEditSummary(e.target.value)}
						placeholder="简要描述你的更改（可选）"
						className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>
				<label className="flex items-center gap-2 text-sm text-foreground">
					<input
						type="checkbox"
						checked={minorEdit}
						onChange={(e) => setMinorEdit(e.target.checked)}
						className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
					/>
					小编辑
				</label>
			</div>

			{/* Action buttons */}
			<div className="flex items-center gap-3 border-t border-border pt-4">
				<button
					type="button"
					onClick={handleSave}
					disabled={saving}
					className={cn(
						'inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
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
					className="rounded-md border border-border px-5 py-2 text-sm text-foreground transition-colors hover:bg-muted"
				>
					取消
				</button>
			</div>
		</div>
	)
}
