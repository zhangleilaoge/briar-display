'use client'

import { type FileItem, getFileContent } from '@/api/files'
import { Button } from '@/components/ui/button'
import { Check, Clipboard, Download, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import ExcelPreview from './ExcelPreview'
import FileTypeIcon from './FileTypeIcon'
import MarkdownPreview from './MarkdownPreview'

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function isMarkdown(name: string): boolean {
	const lower = name.toLowerCase()
	return lower.endsWith('.md') || lower.endsWith('.markdown')
}

type PreviewKind = 'image' | 'video' | 'markdown' | 'text' | 'pdf' | 'excel' | 'none'

const EXCEL_EXTENSIONS = ['.xls', '.xlsx']

function getPreviewKind(file: FileItem): PreviewKind {
	if (file.mimeType.startsWith('image/')) return 'image'
	if (file.mimeType.startsWith('video/')) return 'video'
	if (isMarkdown(file.originalName)) return 'markdown'
	if (file.mimeType.startsWith('text/') || file.mimeType === 'application/json') return 'text'
	if (file.mimeType === 'application/pdf' || file.originalName.toLowerCase().endsWith('.pdf'))
		return 'pdf'
	const lower = file.originalName.toLowerCase()
	if (EXCEL_EXTENSIONS.some((ext) => lower.endsWith(ext))) return 'excel'
	return 'none'
}

interface Props {
	file: FileItem
	onClose: () => void
	onDelete: (id: string) => void
}

export default function FileDetailModal({ file, onClose, onDelete }: Props) {
	const [copied, setCopied] = useState(false)
	const [previewOpen, setPreviewOpen] = useState(false)
	const [textContent, setTextContent] = useState<string | null>(null)
	const [textError, setTextError] = useState<string | null>(null)

	const kind = getPreviewKind(file)

	useEffect(() => {
		if (kind !== 'markdown' && kind !== 'text') return
		let cancelled = false
		getFileContent(file.id)
			.then((content) => {
				if (!cancelled) setTextContent(String(content))
			})
			.catch((err: any) => {
				if (!cancelled) setTextError(err?.response?.data?.message || '加载内容失败')
			})
		return () => {
			cancelled = true
		}
	}, [file.id, kind])

	const copyLink = async () => {
		await navigator.clipboard.writeText(file.cdnUrl)
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}

	const download = async () => {
		try {
			const res = await fetch(file.cdnUrl)
			const blob = await res.blob()
			const url = URL.createObjectURL(blob)
			const a = document.createElement('a')
			a.href = url
			a.download = file.originalName
			document.body.appendChild(a)
			a.click()
			document.body.removeChild(a)
			URL.revokeObjectURL(url)
		} catch {
			window.open(file.cdnUrl, '_blank')
		}
	}

	return (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
			onClick={onClose}
		>
			{/* 全屏图片预览（仅图片类型可用，点击任意处关闭） */}
			{previewOpen && (
				<div
					className="fixed inset-0 z-[110] flex cursor-zoom-out items-center justify-center bg-black/90 p-4"
					onClick={(e) => {
						e.stopPropagation()
						setPreviewOpen(false)
					}}
				>
					<img
						src={file.cdnUrl}
						alt={file.originalName}
						className="max-h-full max-w-full object-contain"
					/>
				</div>
			)}

			<div
				className="relative max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-background shadow-2xl"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-6 py-3">
					<h2 className="truncate text-sm font-medium">{file.originalName}</h2>
					<Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
						<X className="h-4 w-4" />
					</Button>
				</div>

				<div className="p-6">
					{/* Preview */}
					<div className="mb-6">
						{kind === 'image' && (
							<div className="flex justify-center rounded-lg bg-muted p-4">
								<img
									src={file.cdnUrl}
									alt={file.originalName}
									title="点击全屏预览"
									className="max-h-[50vh] max-w-full cursor-zoom-in object-contain"
									onClick={() => setPreviewOpen(true)}
								/>
							</div>
						)}
						{kind === 'video' && (
							<div className="flex justify-center rounded-lg bg-black p-2">
								{/* biome-ignore lint/a11y/useMediaCaption: 用户上传的视频没有字幕文件 */}
								<video src={file.cdnUrl} controls autoPlay className="max-h-[50vh] max-w-full" />
							</div>
						)}
						{(kind === 'markdown' || kind === 'text') && (
							<>
								{textError && (
									<div className="rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">
										{textError}
									</div>
								)}
								{!textError && textContent === null && (
									<div className="rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">
										加载中...
									</div>
								)}
								{!textError && textContent !== null && kind === 'markdown' && (
									<MarkdownPreview markdown={textContent} />
								)}
								{!textError && textContent !== null && kind === 'text' && (
									<pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted p-4 text-xs">
										{textContent}
									</pre>
								)}
							</>
						)}
						{kind === 'pdf' && (
							<iframe
								src={file.cdnUrl}
								title={file.originalName}
								className="h-[60vh] w-full rounded-lg border bg-muted"
							/>
						)}
						{kind === 'excel' && <ExcelPreview file={file} />}
						{kind === 'none' && (
							<div className="flex flex-col items-center gap-2 rounded-lg bg-muted py-10 text-muted-foreground">
								<FileTypeIcon fileName={file.originalName} mimeType={file.mimeType} />
								<p className="text-sm">该类型不支持预览</p>
							</div>
						)}
					</div>

					{/* Metadata */}
					<div className="mb-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
						<div>
							<p className="text-muted-foreground">大小</p>
							<p className="font-medium">{formatSize(file.size)}</p>
						</div>
						<div>
							<p className="text-muted-foreground">类型</p>
							<p className="font-medium">{file.mimeType}</p>
						</div>
						{file.width && file.height ? (
							<div>
								<p className="text-muted-foreground">尺寸</p>
								<p className="font-medium">
									{file.width} × {file.height}
								</p>
							</div>
						) : (
							<div>
								<p className="text-muted-foreground">上传时间</p>
								<p className="font-medium">
									{new Date(file.createdAt).toLocaleDateString('zh-CN')}
								</p>
							</div>
						)}
					</div>

					{/* Actions */}
					<div className="flex flex-wrap items-center gap-2 border-t pt-4">
						<Button variant="outline" size="sm" className="gap-1.5" onClick={copyLink}>
							{copied ? (
								<Check className="h-4 w-4 text-green-600" />
							) : (
								<Clipboard className="h-4 w-4" />
							)}
							复制链接
						</Button>
						<Button variant="outline" size="sm" className="gap-1.5" onClick={download}>
							<Download className="h-4 w-4" /> 下载
						</Button>
						<Button
							variant="destructive"
							size="sm"
							className="gap-1.5 ml-auto"
							onClick={() => onDelete(file.id)}
						>
							<X className="h-4 w-4" /> 删除
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}
