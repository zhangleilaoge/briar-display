'use client'

import { BlockNoteView } from '@blocknote/mantine'
import { useCreateBlockNote } from '@blocknote/react'
import '@blocknote/mantine/style.css'
import { useEffect, useState } from 'react'

interface MarkdownPreviewProps {
	markdown: string
}

/** md 文件只读预览，复用 wiki 的 BlockNote 渲染 */
export default function MarkdownPreview({ markdown }: MarkdownPreviewProps) {
	const editor = useCreateBlockNote()
	const [parseFailed, setParseFailed] = useState(false)

	useEffect(() => {
		let cancelled = false
		;(async () => {
			try {
				const blocks = await editor.tryParseMarkdownToBlocks(markdown)
				if (!cancelled) {
					editor.replaceBlocks(editor.document, blocks)
				}
			} catch (err) {
				console.error('Markdown 解析失败:', err)
				if (!cancelled) setParseFailed(true)
			}
		})()
		return () => {
			cancelled = true
		}
	}, [editor, markdown])

	if (parseFailed) {
		return (
			<pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted p-4 text-xs">
				{markdown}
			</pre>
		)
	}

	return (
		<div className="max-h-[50vh] overflow-auto rounded-lg border p-2">
			<BlockNoteView editor={editor} editable={false} theme="light" />
		</div>
	)
}
