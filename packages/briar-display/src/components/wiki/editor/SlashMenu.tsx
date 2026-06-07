'use client'

import type { Editor } from '@tiptap/core'
import {
	CheckSquare,
	Code,
	FileCode,
	FileText,
	Heading2,
	Heading3,
	Heading4,
	ImageIcon,
	Link2,
	List,
	ListOrdered,
	Minus,
	Quote,
	TableIcon,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface SlashMenuItem {
	label: string
	description: string
	icon: React.ElementType
	action: (editor: Editor) => void
	aliases?: string[]
}

const SLASH_COMMANDS: SlashMenuItem[] = [
	{
		label: '标题 2',
		description: '二级标题',
		icon: Heading2,
		action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
		aliases: ['h2', 'heading2'],
	},
	{
		label: '标题 3',
		description: '三级标题',
		icon: Heading3,
		action: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
		aliases: ['h3', 'heading3'],
	},
	{
		label: '标题 4',
		description: '四级标题',
		icon: Heading4,
		action: (e) => e.chain().focus().toggleHeading({ level: 4 }).run(),
		aliases: ['h4', 'heading4'],
	},
	{
		label: '无序列表',
		description: '项目符号列表',
		icon: List,
		action: (e) => e.chain().focus().toggleBulletList().run(),
		aliases: ['bullet', 'ul'],
	},
	{
		label: '有序列表',
		description: '编号列表',
		icon: ListOrdered,
		action: (e) => e.chain().focus().toggleOrderedList().run(),
		aliases: ['number', 'ol'],
	},
	{
		label: '任务列表',
		description: '带复选框的列表',
		icon: CheckSquare,
		action: (e) => e.chain().focus().toggleTaskList().run(),
		aliases: ['task', 'todo', 'checkbox'],
	},
	{
		label: '表格',
		description: '插入 3×3 表格',
		icon: TableIcon,
		action: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
		aliases: ['table'],
	},
	{
		label: '代码块',
		description: '语法高亮代码块',
		icon: Code,
		action: (e) => e.chain().focus().toggleCodeBlock().run(),
		aliases: ['code'],
	},
	{
		label: '引用',
		description: '引用文本块',
		icon: Quote,
		action: (e) => e.chain().focus().toggleBlockquote().run(),
		aliases: ['quote', 'blockquote'],
	},
	{
		label: '分割线',
		description: '水平分割线',
		icon: Minus,
		action: (e) => e.chain().focus().setHorizontalRule().run(),
		aliases: ['hr', 'divider', 'separator'],
	},
	{
		label: '图片',
		description: '插入图片（URL）',
		icon: ImageIcon,
		action: () => {
			const url = window.prompt('请输入图片 URL')
			if (url) {
				// We need editor access — handled via callback in parent
			}
		},
		aliases: ['image', 'img'],
	},
	{
		label: '链接',
		description: '插入超链接',
		icon: Link2,
		action: () => {},
		aliases: ['link', 'href'],
	},
	{
		label: '提及页面',
		description: '插入 Wiki 页面链接',
		icon: FileText,
		action: () => {},
		aliases: ['mention', 'wiki'],
	},
	{
		label: '模板',
		description: '插入模板引用',
		icon: FileCode,
		action: () => {},
		aliases: ['template'],
	},
]

interface SlashMenuProps {
	editor: Editor
	query: string
	position: { top: number; left: number }
	onClose: () => void
	onAction?: (type: 'image' | 'link' | 'mention' | 'template') => void
}

export default function SlashMenu({ editor, query, position, onClose, onAction }: SlashMenuProps) {
	const [selectedIndex, setSelectedIndex] = useState(0)
	const menuRef = useRef<HTMLDivElement>(null)

	const filtered = SLASH_COMMANDS.filter((cmd) => {
		if (!query) return true
		const q = query.toLowerCase()
		return (
			cmd.label.toLowerCase().includes(q) ||
			cmd.description.toLowerCase().includes(q) ||
			cmd.aliases?.some((a) => a.includes(q))
		)
	})

	useEffect(() => {
		setSelectedIndex(0)
	}, [query])

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === 'ArrowDown') {
				e.preventDefault()
				setSelectedIndex((i) => (i + 1) % filtered.length)
			} else if (e.key === 'ArrowUp') {
				e.preventDefault()
				setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length)
			} else if (e.key === 'Enter') {
				e.preventDefault()
				const item = filtered[selectedIndex]
				if (item) executeAction(item)
			} else if (e.key === 'Escape') {
				e.preventDefault()
				onClose()
			}
		}
		document.addEventListener('keydown', handler, true)
		return () => document.removeEventListener('keydown', handler, true)
	}, [filtered, selectedIndex, onClose])

	// Scroll selected item into view
	useEffect(() => {
		if (menuRef.current) {
			const selected = menuRef.current.querySelector('[data-selected="true"]')
			selected?.scrollIntoView({ block: 'nearest' })
		}
	}, [selectedIndex])

	const executeAction = useCallback(
		(item: SlashMenuItem) => {
			// Remove the slash command text from the editor
			const { state } = editor
			const { $from } = state.selection
			const text = $from.parent.textContent
			const cursorPos = $from.parentOffset
			const beforeCursor = text.slice(0, cursorPos)
			const slashMatch = beforeCursor.match(/^\/(.*)$/)

			if (slashMatch) {
				const slashStart = $from.start()
				const slashEnd = slashStart + cursorPos
				editor
					.chain()
					.focus()
					.deleteRange({ from: slashStart - 1, to: slashEnd })
					.run()
			}

			// Special actions that need parent coordination
			if (item.aliases?.includes('image') && onAction) {
				onClose()
				onAction('image')
				return
			}
			if (item.aliases?.includes('link') && onAction) {
				onClose()
				onAction('link')
				return
			}
			if (item.aliases?.includes('mention') && onAction) {
				onClose()
				onAction('mention')
				return
			}
			if (item.aliases?.includes('template') && onAction) {
				onClose()
				onAction('template')
				return
			}

			item.action(editor)
			onClose()
		},
		[editor, onClose, onAction],
	)

	if (filtered.length === 0) {
		return createPortal(
			// biome-ignore lint/a11y/useKeyWithClickEvents: backdrop
			<div className="fixed inset-0 z-[9998]" onClick={onClose} />,
			document.body,
		)
	}

	return createPortal(
		<>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop */}
			<div className="fixed inset-0 z-[9998]" onClick={onClose} />
			<div
				ref={menuRef}
				className="fixed z-[9999] w-64 overflow-hidden rounded-md border border-wiki-border-light bg-white shadow-lg"
				style={{ top: position.top, left: position.left }}
			>
				<div className="max-h-[280px] overflow-y-auto py-1">
					{filtered.map((item, i) => {
						const Icon = item.icon
						return (
							<button
								key={item.label}
								type="button"
								data-selected={i === selectedIndex}
								onMouseEnter={() => setSelectedIndex(i)}
								onClick={() => executeAction(item)}
								className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
									i === selectedIndex ? 'bg-wiki-bg-tertiary' : 'hover:bg-wiki-bg-secondary'
								}`}
							>
								<div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded border border-wiki-border-light bg-wiki-bg">
									<Icon className="h-4 w-4 text-wiki-text-secondary" />
								</div>
								<div className="min-w-0 flex-1">
									<p className="truncate text-[13px] font-medium text-wiki-text">{item.label}</p>
									<p className="truncate text-[11px] text-wiki-text-muted">{item.description}</p>
								</div>
							</button>
						)
					})}
				</div>
			</div>
		</>,
		document.body,
	)
}
