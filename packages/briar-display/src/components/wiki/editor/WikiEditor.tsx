'use client'

import { BlockNoteView } from '@blocknote/mantine'
import { useCreateBlockNote } from '@blocknote/react'
import '@blocknote/mantine/style.css'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

export interface WikiEditorHandle {
	getMarkdown: () => string
}

interface WikiEditorProps {
	initialContent?: string
	onChange?: (markdown: string) => void
	placeholder?: string
}

const WikiEditor = forwardRef<WikiEditorHandle, WikiEditorProps>(function WikiEditor(
	{ initialContent = '', onChange, placeholder = '开始编写文章内容...' },
	ref,
) {
	const mdRef = useRef('')
	const editor = useCreateBlockNote()

	// Set initial content using our own markdown parser (avoids DOMParser issues)
	useEffect(() => {
		if (!editor || !initialContent.trim()) return
		const blocks = parseMarkdownToBlocks(initialContent)
		if (blocks.length > 0) {
			editor.replaceBlocks(editor.document, blocks)
		}
	}, []) // eslint-disable-line react-hooks/exhaustive-deps

	// Expose getMarkdown
	useImperativeHandle(
		ref,
		() => ({
			getMarkdown: () => mdRef.current,
		}),
		[],
	)

	// Handle content changes
	const handleChange = () => {
		try {
			const blocks = editor.document
			const md = serializeBlocks(blocks)
			mdRef.current = md
			onChange?.(md)
		} catch (e) {
			console.error('serialize failed:', e)
		}
	}

	return (
		<div className="wiki-editor-container overflow-hidden rounded-sm border border-wiki-border-light">
			<BlockNoteView
				editor={editor}
				onChange={handleChange}
				theme="light"
				data-placeholder={placeholder}
				className="min-h-[400px]"
			/>
		</div>
	)
})

// ========== Inline content helpers ==========

function inlineToText(content: any): string {
	if (!Array.isArray(content)) return ''
	return content
		.map((item: any) => {
			if (!item) return ''
			if (item.type === 'text') {
				let t = item.text || ''
				const s = item.styles
				if (s?.bold) t = `**${t}**`
				if (s?.italic) t = `*${t}*`
				if (s?.code) t = `\`${t}\``
				if (s?.strike) t = `~~${t}~~`
				return t
			}
			if (item.type === 'link') {
				const text = inlineToText(item.content)
				return `[${text}](${item.href})`
			}
			return ''
		})
		.join('')
}

function textToInline(text: string): any[] {
	if (!text) return []
	// Parse basic markdown styles: **bold**, *italic*, `code`, ~~strike~~, [link](url)
	const parts: any[] = []
	const remaining = text

	const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|~~(.+?)~~|\[(.+?)\]\((.+?)\))/g
	let lastIndex = 0

	for (const match of remaining.matchAll(regex)) {
		// Add text before match
		if (match.index > lastIndex) {
			parts.push({ type: 'text', text: remaining.slice(lastIndex, match.index), styles: {} })
		}

		if (match[2]) {
			// bold
			parts.push({ type: 'text', text: match[2], styles: { bold: true } })
		} else if (match[3]) {
			// italic
			parts.push({ type: 'text', text: match[3], styles: { italic: true } })
		} else if (match[4]) {
			// code
			parts.push({ type: 'text', text: match[4], styles: { code: true } })
		} else if (match[5]) {
			// strike
			parts.push({ type: 'text', text: match[5], styles: { strike: true } })
		} else if (match[6] && match[7]) {
			// link
			parts.push({
				type: 'link',
				href: match[7],
				content: [{ type: 'text', text: match[6], styles: {} }],
			})
		}

		lastIndex = match.index + match[0].length
	}

	if (lastIndex < remaining.length) {
		parts.push({ type: 'text', text: remaining.slice(lastIndex), styles: {} })
	}

	return parts.length > 0 ? parts : [{ type: 'text', text: text, styles: {} }]
}

// ========== Serializer ==========

function serializeBlocks(blocks: any[]): string {
	if (!Array.isArray(blocks)) return ''
	return blocks
		.map((b) => serializeBlock(b))
		.filter(Boolean)
		.join('\n\n')
}

function serializeBlock(block: any): string {
	if (!block) return ''
	const { type, content, props = {}, children = [] } = block

	switch (type) {
		case 'paragraph':
			return inlineToText(content)
		case 'heading': {
			const level = props.level || 2
			return `${'#'.repeat(level)} ${inlineToText(content)}`
		}
		case 'bulletList':
			return children.map((c: any) => `- ${serializeBlock(c)}`).join('\n')
		case 'numberedList':
			return children.map((c: any, i: number) => `${i + 1}. ${serializeBlock(c)}`).join('\n')
		case 'listItem':
			return inlineToText(content)
		case 'checkListItem': {
			const checked = props.checked ? 'x' : ' '
			const text = inlineToText(content)
			return text ? `[${checked}] ${text}` : `[${checked}]`
		}
		case 'codeBlock': {
			const lang = props.language || ''
			return `\`\`\`${lang}\n${inlineToText(content)}\n\`\`\``
		}
		case 'blockquote':
			return `> ${inlineToText(content)}`
		case 'image':
			return `![${props.caption || ''}](${props.url || ''})`
		case 'table': {
			const tableContent = content
			if (!tableContent?.rows) return ''
			const lines: string[] = []
			for (let i = 0; i < tableContent.rows.length; i++) {
				const cells = tableContent.rows[i].cells || []
				lines.push(
					`| ${cells
						.map((cell: any) => {
							// BlockNote v0.51: cell is { type: "tableCell", content: InlineContent[] }
							if (cell && typeof cell === 'object' && cell.type) {
								return inlineToText(cell.content)
							}
							// Fallback: cell is InlineContent[]
							return inlineToText(cell)
						})
						.join(' | ')} |`,
				)
				if (i === 0) lines.push(`| ${cells.map(() => '---').join(' | ')} |`)
			}
			return lines.join('\n')
		}
		default:
			return inlineToText(content)
	}
}

// ========== Markdown parser (sync, no DOMParser) ==========

function parseMarkdownToBlocks(md: string): any[] {
	const lines = md.split('\n')
	const blocks: any[] = []
	let i = 0

	while (i < lines.length) {
		const line = lines[i]
		const trimmed = line.trim()

		// Empty line
		if (trimmed === '') {
			i++
			continue
		}

		// Code block
		if (trimmed.startsWith('```')) {
			const lang = trimmed.slice(3).trim()
			const codeLines: string[] = []
			i++
			while (i < lines.length && !lines[i].trim().startsWith('```')) {
				codeLines.push(lines[i])
				i++
			}
			i++ // skip closing ```
			blocks.push({
				type: 'codeBlock',
				props: { language: lang },
				content: textToInline(codeLines.join('\n')),
				children: [],
			})
			continue
		}

		// Heading
		const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
		if (headingMatch) {
			const level = headingMatch[1].length
			blocks.push({
				type: 'heading',
				props: { level },
				content: textToInline(headingMatch[2]),
				children: [],
			})
			i++
			continue
		}

		// Blockquote
		if (trimmed.startsWith('> ')) {
			blocks.push({
				type: 'blockquote',
				content: textToInline(trimmed.slice(2)),
				children: [],
			})
			i++
			continue
		}

		// Unordered list
		if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
			const items: any[] = []
			while (
				i < lines.length &&
				(lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))
			) {
				const itemText = lines[i].trim().slice(2)
				items.push({
					type: 'listItem',
					content: textToInline(itemText),
					children: [],
				})
				i++
			}
			blocks.push({
				type: 'bulletList',
				children: items,
			})
			continue
		}

		// Ordered list
		const olMatch = trimmed.match(/^\d+\.\s+(.+)$/)
		if (olMatch) {
			const items: any[] = []
			while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
				const itemText = lines[i].trim().replace(/^\d+\.\s+/, '')
				items.push({
					type: 'listItem',
					content: textToInline(itemText),
					children: [],
				})
				i++
			}
			blocks.push({
				type: 'numberedList',
				children: items,
			})
			continue
		}

		// Task list
		const taskMatch = trimmed.match(/^\[([ x])\]\s*(.*)$/)
		if (taskMatch) {
			blocks.push({
				type: 'checkListItem',
				props: { checked: taskMatch[1] === 'x' },
				content: textToInline(taskMatch[2]),
				children: [],
			})
			i++
			continue
		}

		// Image
		const imgMatch = trimmed.match(/^!\[(.*?)\]\((.+?)\)$/)
		if (imgMatch) {
			blocks.push({
				type: 'image',
				props: { url: imgMatch[2], caption: imgMatch[1] },
				content: undefined,
				children: [],
			})
			i++
			continue
		}

		// Table
		if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
			const tableLines: string[] = []
			while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
				tableLines.push(lines[i].trim())
				i++
			}
			// Parse table
			if (tableLines.length >= 2) {
				const parseRow = (line: string) =>
					line
						.split('|')
						.slice(1, -1)
						.map((c) => textToInline(c.trim()))
				const headerCells = parseRow(tableLines[0])
				// Skip separator row (index 1)
				const rows = [{ cells: headerCells }]
				for (let r = 2; r < tableLines.length; r++) {
					rows.push({ cells: parseRow(tableLines[r]) })
				}
				blocks.push({
					type: 'table',
					content: { type: 'tableContent', rows },
					children: [],
				})
			}
			continue
		}

		// Paragraph (default)
		blocks.push({
			type: 'paragraph',
			content: textToInline(trimmed),
			children: [],
		})
		i++
	}

	return blocks
}

export default WikiEditor
