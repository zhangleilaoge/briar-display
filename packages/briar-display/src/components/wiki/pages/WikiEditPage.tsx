'use client'

import { wikiApi } from '@/api/wiki'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import TagInput from '@/components/wiki/common/TagInput'
import WikiBreadcrumbs from '@/components/wiki/common/WikiBreadcrumbs'
import CategorySelector from '@/components/wiki/editor/CategorySelector'
import {
	ToolbarButton,
	ToolbarSeparator,
	renderMentions,
} from '@/components/wiki/editor/EditorToolbar'
import WikiTabs from '@/components/wiki/layout/WikiTabs'
import { cn } from '@/lib/utils'
import type { WikiPage, WikiPageVisibility, WikiSearchResult } from '@briar/shared'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
	Bold,
	Code,
	FileText,
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
	Upload,
	X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Markdown } from 'tiptap-markdown'

interface WikiEditPageProps {
	slug: string
}

type EditMode = 'visual' | 'source'

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

	// Link state
	const [showLinkMenu, setShowLinkMenu] = useState(false)
	const [linkUrl, setLinkUrl] = useState('')

	// Image upload state
	const [showImageMenu, setShowImageMenu] = useState(false)
	const [imageUrl, setImageUrl] = useState('')
	const fileInputRef = useRef<HTMLInputElement>(null)

	/** 读取本地图片文件转为 base64 并插入编辑器 */
	const handleImageFile = useCallback((file: File, view: import('prosemirror-view').EditorView) => {
		const reader = new FileReader()
		reader.onload = () => {
			if (typeof reader.result === 'string') {
				const { state, dispatch } = view
				const node = state.schema.nodes.image.create({ src: reader.result })
				dispatch(state.tr.replaceSelectionWith(node))
			}
		}
		reader.readAsDataURL(file)
	}, [])

	// TipTap editor
	const editor = useEditor({
		extensions: [
			StarterKit,
			Underline,
			Highlight.configure({ multicolor: false }),
			Link.configure({
				openOnClick: false,
				HTMLAttributes: { class: 'text-wiki-link hover:underline cursor-pointer' },
			}),
			Image.configure({
				HTMLAttributes: { class: 'max-w-full h-auto rounded-sm' },
				allowBase64: true,
			}),
			Placeholder.configure({
				placeholder: '开始编写文章内容...',
			}),
			Markdown.configure({
				html: true,
				transformPastedText: true,
				transformCopiedText: true,
			}),
		],
		content: '',
		editorProps: {
			attributes: {
				class: 'prose prose-wiki max-w-none focus:outline-none min-h-[400px] p-4',
			},
			handlePaste: (view, event) => {
				const items = event.clipboardData?.items
				if (!items) return false
				for (const item of items) {
					if (item.type.startsWith('image/')) {
						event.preventDefault()
						const file = item.getAsFile()
						if (file) handleImageFile(file, view)
						return true
					}
				}
				return false
			},
			handleDrop: (view, event) => {
				const files = event.dataTransfer?.files
				if (!files?.length) return false
				for (const file of Array.from(files)) {
					if (file.type.startsWith('image/')) {
						event.preventDefault()
						handleImageFile(file, view)
						return true
					}
				}
				return false
			},
		},
	})

	// Subscribe to editor state for reactive toolbar highlights
	const editorState = useEditorState({
		editor,
		selector: ({ editor: e }) => ({
			isBold: e.isActive('bold'),
			isItalic: e.isActive('italic'),
			isHeading2: e.isActive('heading', { level: 2 }),
			isHeading3: e.isActive('heading', { level: 3 }),
			isHeading4: e.isActive('heading', { level: 4 }),
			isBulletList: e.isActive('bulletList'),
			isOrderedList: e.isActive('orderedList'),
			isCodeBlock: e.isActive('codeBlock'),
			isBlockquote: e.isActive('blockquote'),
			isLink: e.isActive('link'),
			canUndo: e.can().undo(),
			canRedo: e.can().redo(),
		}),
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

	/** 从 TipTap 编辑器获取 Markdown 内容 */
	const getEditorMarkdown = useCallback((): string => {
		if (!editor) return ''
		// @ts-expect-error tiptap-markdown storage type
		return editor.storage.markdown.getMarkdown()
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
	const openLinkMenu = useCallback(() => {
		if (!editor) return
		// Pre-fill with existing link URL if cursor is on a link
		if (editor.isActive('link')) {
			setLinkUrl(editor.getAttributes('link').href || '')
		} else {
			setLinkUrl('')
		}
		setShowLinkMenu(true)
	}, [editor])

	const insertLink = useCallback(() => {
		if (!editor || !linkUrl.trim()) return
		editor.chain().focus().setLink({ href: linkUrl.trim() }).run()
		setLinkUrl('')
		setShowLinkMenu(false)
	}, [editor, linkUrl])

	const removeLink = useCallback(() => {
		if (!editor) return
		editor.chain().focus().unsetLink().run()
		setLinkUrl('')
		setShowLinkMenu(false)
	}, [editor])

	const addImageFromUrl = useCallback(() => {
		if (!editor || !imageUrl.trim()) return
		editor.chain().focus().setImage({ src: imageUrl.trim() }).run()
		setImageUrl('')
		setShowImageMenu(false)
	}, [editor, imageUrl])

	const handleFileSelect = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0]
			if (file && editor) {
				const reader = new FileReader()
				reader.onload = () => {
					if (typeof reader.result === 'string') {
						editor.chain().focus().setImage({ src: reader.result }).run()
					}
				}
				reader.readAsDataURL(file)
			}
			e.target.value = ''
			setShowImageMenu(false)
		},
		[editor],
	)

	// Mention page (wiki link)
	const [showMention, setShowMention] = useState(false)
	const [mentionQuery, setMentionQuery] = useState('')
	const [mentionResults, setMentionResults] = useState<WikiSearchResult[]>([])
	const [mentionLoading, setMentionLoading] = useState(false)

	const searchPages = useCallback(async (q: string) => {
		if (!q.trim()) {
			setMentionResults([])
			return
		}
		setMentionLoading(true)
		const res = await wikiApi.search(q, 8)
		if (res.success && res.data) {
			setMentionResults(res.data.items)
		}
		setMentionLoading(false)
	}, [])

	const insertWikiLink = useCallback(
		(pageTitle: string) => {
			if (!editor) return
			editor.chain().focus().insertContent(`[[${pageTitle}]]`).run()
			setShowMention(false)
			setMentionQuery('')
			setMentionResults([])
		},
		[editor],
	)

	if (loading) {
		return (
			<div className="space-y-4">
				<WikiBreadcrumbs items={[{ label: isNew ? '新建文章' : '编辑文章' }]} />
				{!isNew && <WikiTabs slug={slug} active="edit" />}
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
			{!isNew && <WikiTabs slug={slug} active="edit" />}

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
				<label htmlFor="wiki-title" className="mb-3 block text-[13px] font-medium text-wiki-text">
					标题
				</label>
				<Input
					id="wiki-title"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					placeholder="输入文章标题"
				/>
			</div>

			{/* Visibility */}
			<div>
				<label className="mb-3 block text-[13px] font-medium text-wiki-text">可见性</label>
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
				<label className="mb-3 block text-[13px] font-medium text-wiki-text">标签</label>
				<TagInput value={tags} onChange={setTags} />
				<p className="mt-1 text-[11px] text-wiki-text-muted">
					回车或逗号添加标签，输入时显示已有标签建议
				</p>
			</div>
			{/* Categories */}
			<div>
				<label className="mb-3 block text-[13px] font-medium text-wiki-text">分类</label>
				<CategorySelector selected={categoryIds} onChange={setCategoryIds} />
			</div>

			<label className="mb-3 block text-[13px] font-medium text-wiki-text">内容</label>
			{/* Mode toggle */}
			<div className="flex items-center gap-2">
				<Button
					variant={mode === 'visual' ? 'default' : 'outline'}
					onClick={() => handleModeChange('visual')}
				>
					可视化
				</Button>
				<Button
					variant={mode === 'source' ? 'default' : 'outline'}
					onClick={() => handleModeChange('source')}
				>
					源码
				</Button>
			</div>

			{/* Visual editor mode */}
			{mode === 'visual' && editor && (
				<div className="overflow-hidden rounded-sm border border-wiki-border-light">
					{/* Toolbar */}
					<div className="flex flex-wrap items-center gap-0.5 border-b border-wiki-border-light bg-wiki-bg-secondary px-2 py-1.5">
						<ToolbarButton
							icon={Bold}
							label="加粗"
							isActive={editorState.isBold}
							onClick={() => editor.chain().focus().toggleBold().run()}
						/>
						<ToolbarButton
							icon={Italic}
							label="斜体"
							isActive={editorState.isItalic}
							onClick={() => editor.chain().focus().toggleItalic().run()}
						/>

						<ToolbarSeparator />

						<ToolbarButton
							icon={Heading2}
							label="标题 2"
							isActive={editorState.isHeading2}
							onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
						/>
						<ToolbarButton
							icon={Heading3}
							label="标题 3"
							isActive={editorState.isHeading3}
							onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
						/>
						<ToolbarButton
							icon={Heading4}
							label="标题 4"
							isActive={editorState.isHeading4}
							onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
						/>

						<ToolbarSeparator />

						<ToolbarButton
							icon={List}
							label="无序列表"
							isActive={editorState.isBulletList}
							onClick={() => editor.chain().focus().toggleBulletList().run()}
						/>
						<ToolbarButton
							icon={ListOrdered}
							label="有序列表"
							isActive={editorState.isOrderedList}
							onClick={() => editor.chain().focus().toggleOrderedList().run()}
						/>

						<ToolbarSeparator />

						<Popover open={showLinkMenu} onOpenChange={setShowLinkMenu}>
							<PopoverTrigger asChild>
								<div>
									<ToolbarButton
										icon={Link2}
										label="插入链接"
										isActive={editorState.isLink}
										onClick={openLinkMenu}
									/>
								</div>
							</PopoverTrigger>
							<PopoverContent className="w-72" align="start" sideOffset={4}>
								<div className="space-y-3">
									<p className="font-medium text-sm">插入链接</p>
									<div className="flex gap-1.5">
										<Input
											value={linkUrl}
											onChange={(e) => setLinkUrl(e.target.value)}
											onKeyDown={(e) => e.key === 'Enter' && insertLink()}
											placeholder="https://..."
											className="flex-1"
										/>
										<Button size="sm" onClick={insertLink} disabled={!linkUrl.trim()}>
											确定
										</Button>
									</div>
									{editorState.isLink && (
										<button
											type="button"
											onClick={removeLink}
											className="w-full rounded-md border border-input px-2 py-1 text-sm text-destructive transition-colors hover:bg-destructive/10"
										>
											移除链接
										</button>
									)}
								</div>
							</PopoverContent>
						</Popover>
						<Popover open={showMention} onOpenChange={setShowMention}>
							<PopoverTrigger asChild>
								<div>
									<ToolbarButton
										icon={FileText}
										label="提及文档"
										onClick={() => setShowMention(!showMention)}
									/>
								</div>
							</PopoverTrigger>
							<PopoverContent className="w-72 p-0" align="start" sideOffset={4}>
								<div className="p-2">
									<div className="flex items-center gap-1">
										<Input
											value={mentionQuery}
											onChange={(e) => {
												setMentionQuery(e.target.value)
												searchPages(e.target.value)
											}}
											placeholder="搜索页面标题..."
											className="flex-1"
										/>
										<Button
											variant="ghost"
											size="icon"
											className="h-8 w-8"
											onClick={() => {
												setShowMention(false)
												setMentionQuery('')
											}}
										>
											<X className="h-3.5 w-3.5" />
										</Button>
									</div>
								</div>
								<div className="max-h-[200px] overflow-y-auto border-t border-wiki-border-light">
									{mentionLoading ? (
										<div className="flex items-center gap-2 px-3 py-2 text-[12px] text-wiki-text-muted">
											<Loader2 className="h-3 w-3 animate-spin" />
											搜索中...
										</div>
									) : mentionResults.length > 0 ? (
										mentionResults.map((page) => (
											<button
												key={page.id}
												type="button"
												onClick={() => insertWikiLink(page.title)}
												className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors hover:bg-wiki-bg-tertiary"
											>
												<FileText className="h-3.5 w-3.5 flex-shrink-0 text-wiki-text-muted" />
												<span className="truncate text-wiki-link">{page.title}</span>
											</button>
										))
									) : mentionQuery.trim() ? (
										<div className="px-3 py-2 text-[12px] text-wiki-text-muted">未找到匹配页面</div>
									) : (
										<div className="px-3 py-2 text-[12px] text-wiki-text-muted">
											输入关键词搜索页面
										</div>
									)}
								</div>
							</PopoverContent>
						</Popover>
						<ToolbarButton
							icon={Code}
							label="代码块"
							isActive={editorState.isCodeBlock}
							onClick={() => editor.chain().focus().toggleCodeBlock().run()}
						/>
						<ToolbarButton
							icon={Quote}
							label="引用"
							isActive={editorState.isBlockquote}
							onClick={() => editor.chain().focus().toggleBlockquote().run()}
						/>
						<Popover open={showImageMenu} onOpenChange={setShowImageMenu}>
							<PopoverTrigger asChild>
								<div>
									<ToolbarButton
										icon={ImageIcon}
										label="插入图片"
										onClick={() => setShowImageMenu(true)}
									/>
								</div>
							</PopoverTrigger>
							<PopoverContent className="w-72" align="start" sideOffset={4}>
								<div className="space-y-3">
									<p className="font-medium text-sm">插入图片</p>
									<div className="space-y-3">
										<input
											ref={fileInputRef}
											type="file"
											accept="image/*"
											onChange={handleFileSelect}
											className="hidden"
										/>
										<Button
											variant="outline"
											size="sm"
											className="w-full"
											onClick={() => fileInputRef.current?.click()}
										>
											<Upload className="mr-2 h-4 w-4" />
											选择本地文件
										</Button>
										<div className="flex items-center gap-2 text-[12px] text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
											或
										</div>
										<div className="flex gap-1.5">
											<Input
												value={imageUrl}
												onChange={(e) => setImageUrl(e.target.value)}
												onKeyDown={(e) => e.key === 'Enter' && addImageFromUrl()}
												placeholder="https://..."
												className="flex-1 text-sm"
											/>
											<Button size="sm" onClick={addImageFromUrl} disabled={!imageUrl.trim()}>
												确定
											</Button>
										</div>
									</div>
									<p className="text-[11px] text-muted-foreground">
										也可直接粘贴或拖拽图片到编辑器
									</p>
								</div>
							</PopoverContent>
						</Popover>

						<div className="flex-1" />

						<ToolbarButton
							icon={Undo}
							label="撤销"
							disabled={!editorState.canUndo}
							onClick={() => editor.chain().focus().undo().run()}
						/>
						<ToolbarButton
							icon={Redo}
							label="重做"
							disabled={!editorState.canRedo}
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
						<Textarea
							value={sourceContent}
							onChange={(e) => setSourceContent(e.target.value)}
							placeholder="输入 Markdown 源码..."
							className="h-[500px] resize-y font-mono"
						/>
					</div>

					{/* Preview */}
					<div>
						<label className="mb-3 block text-[13px] font-medium text-wiki-text">预览</label>
						<div className="h-[500px] overflow-y-auto rounded-sm border border-wiki-border-light bg-wiki-bg-secondary p-4">
							{sourceContent ? (
								<div className="prose prose-wiki max-w-none">
									<ReactMarkdown>{renderMentions(sourceContent)}</ReactMarkdown>
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
						className="mb-3 block text-[13px] font-medium text-wiki-text"
					>
						编辑摘要
					</label>
					<Input
						id="edit-summary"
						value={editSummary}
						onChange={(e) => setEditSummary(e.target.value)}
						placeholder="简要描述你的更改（可选）"
					/>
				</div>
			</div>

			{/* Action buttons */}
			<div className="flex items-center gap-3 border-t border-wiki-border-light pt-4">
				<Button onClick={handleSave} disabled={saving}>
					{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
					{isNew ? '创建页面' : '保存更改'}
				</Button>
				<Button variant="outline" onClick={handleCancel} disabled={saving}>
					取消
				</Button>
			</div>
		</div>
	)
}
