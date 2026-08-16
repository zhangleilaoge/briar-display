'use client'

import type { FileItem } from '@/api/files'
import { useEffect, useState } from 'react'

/** docx 在线预览：动态 import('mammoth')，仅打开 docx 时加载，转成 HTML 渲染（老 .doc 二进制格式不支持） */
export default function DocxPreview({ file }: { file: FileItem }) {
	const [html, setHtml] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false
		;(async () => {
			try {
				const [mammoth, res] = await Promise.all([import('mammoth'), fetch(file.cdnUrl)])
				if (!res.ok) throw new Error(`HTTP ${res.status}`)
				const result = await mammoth.convertToHtml({ arrayBuffer: await res.arrayBuffer() })
				if (!cancelled) setHtml(result.value)
			} catch {
				if (!cancelled) setError('文档解析失败，请下载后查看')
			}
		})()
		return () => {
			cancelled = true
		}
	}, [file.cdnUrl])

	if (error) {
		return (
			<div className="rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">
				{error}
			</div>
		)
	}
	if (html === null) {
		return (
			<div className="rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">
				加载中...
			</div>
		)
	}

	return (
		// mammoth 只把文档内容映射为 p/strong/table 等语义标签，不输出脚本
		<div
			className="max-h-[60vh] overflow-auto rounded-lg border p-4 text-sm leading-relaxed [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:font-bold [&_img]:max-w-full [&_p]:mb-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_th]:py-1"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: mammoth 输出的 HTML 仅含语义标签
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	)
}
