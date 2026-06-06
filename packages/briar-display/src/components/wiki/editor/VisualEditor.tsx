'use client'

import { wikiApi } from '@/api/wiki'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ToolbarButton, ToolbarSeparator } from '@/components/wiki/editor/EditorToolbar'
import type { WikiSearchResult } from '@briar/shared'
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
	Undo,
	Upload,
	X,
} from 'lucide-react'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Markdown } from 'tiptap-markdown'

export interface VisualEditorHandle {
	getMarkdown: () => string
}

interface VisualEditorProps {
	initialContent?: string
	onChange?: (markdown: string) => void
	placeholder?: string
}

const VisualEditor = forwardRef<VisualEditorHandle, VisualEditorProps>(function VisualEditor(
	{ initialContent = '', onChange, placeholder = '开始编写文章内容...' },
	ref,
) {
	const [showLinkMenu, setShowLinkMenu] = useState(false)
	const [linkUrl, setLinkUrl] = useState('')
	const [showImageMenu, setShowImageMenu] = useState(false)
	const [imageUrl, setImageUrl] = useState('')
	const fileInputRef = useRef<HTMLInputElement>(null)

	// Mention state
	const [showMention, setShowMention] = useState(false)
	const [mentionQuery, setMentionQuery] = useState('')
	const [mentionResults, setMentionResults] = useState<WikiSearchResult[]>([])
	const [mentionLoading, setMentionLoading] = useState(false)

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
			Placeholder.configure({ placeholder }),
			Markdown.configure({
				html: true,
				transformPastedText: true,
				transformCopiedText: true,
			}),
		],
		content: initialContent,
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
		onUpdate: ({ editor: e }) => {
			// @ts-expect-error tiptap-markdown storage type
			const md = e.storage.markdown.getMarkdown()
			onChange?.(md)
		},
	})

	useEffect(() => {
		if (editor && initialContent !== editor.getHTML()) {
			editor.commands.setContent(initialContent)
		}
	}, [editor, initialContent])

	const getMarkdown = useCallback((): string => {
		if (!editor) return ''
		// @ts-expect-error tiptap-markdown storage type
		return editor.storage.markdown.getMarkdown()
	}, [editor])

	useImperativeHandle(ref, () => ({ getMarkdown }), [getMarkdown])

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

	// Toolbar actions
	const openLinkMenu = useCallback(() => {
		if (!editor) return
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

	if (!editor) return null

	return (
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
								<div className="px-3 py-2 text-[12px] text-wiki-text-muted">输入关键词搜索页面</div>
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
							<p className="text-[11px] text-muted-foreground">也可直接粘贴或拖拽图片到编辑器</p>
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

			<EditorContent editor={editor} />
		</div>
	)
})

export default VisualEditor
