'use client'

import { type FileItem, type FolderItem, getFileContent, moveFile } from '@/api/files'
import { Button } from '@/components/ui/button'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Check, Clipboard, Download, ExternalLink, FileIcon, FolderInput, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import MarkdownPreview from './MarkdownPreview'

type LinkFormat = 'url' | 'markdown' | 'html' | 'bbcode'

const FORMAT_LABELS: Record<LinkFormat, string> = {
	url: '直链',
	markdown: 'Markdown',
	html: 'HTML',
	bbcode: 'BBCode',
}

function getLink(item: FileItem, fmt: LinkFormat): string {
	switch (fmt) {
		case 'url':
			return item.cdnUrl
		case 'markdown':
			return `![${item.originalName}](${item.cdnUrl})`
		case 'html':
			return `<img src="${item.cdnUrl}" alt="${item.originalName}" />`
		case 'bbcode':
			return `[img]${item.cdnUrl}[/img]`
	}
}

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

type PreviewKind = 'image' | 'video' | 'markdown' | 'text' | 'none'

function getPreviewKind(file: FileItem): PreviewKind {
	if (file.mimeType.startsWith('image/')) return 'image'
	if (file.mimeType.startsWith('video/')) return 'video'
	if (isMarkdown(file.originalName)) return 'markdown'
	if (file.mimeType.startsWith('text/') || file.mimeType === 'application/json') return 'text'
	return 'none'
}

interface Props {
	file: FileItem
	folders: FolderItem[]
	onClose: () => void
	onDelete: (id: string) => void
	onMoved: () => void
}

export default function FileDetailModal({ file, folders, onClose, onDelete, onMoved }: Props) {
	const [copiedFmt, setCopiedFmt] = useState<LinkFormat | null>(null)
	const [textContent, setTextContent] = useState<string | null>(null)
	const [textError, setTextError] = useState<string | null>(null)

	const kind = getPreviewKind(file)
	const isImage = kind === 'image'
	const linkFormats: LinkFormat[] = isImage ? ['url', 'markdown', 'html', 'bbcode'] : ['url']

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

	const copyLink = async (fmt: LinkFormat) => {
		await navigator.clipboard.writeText(getLink(file, fmt))
		setCopiedFmt(fmt)
		setTimeout(() => setCopiedFmt(null), 2000)
	}

	const handleMove = async (value: string) => {
		const folderId = value === 'root' ? null : value
		try {
			const res = await moveFile(file.id, folderId)
			if (res.success) {
				toast.success('移动成功')
				onMoved()
			} else {
				toast.error(res.message || '移动失败')
			}
		} catch {
			toast.error('移动失败')
		}
	}

	return (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
			onClick={onClose}
		>
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
									className="max-h-[50vh] max-w-full object-contain"
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
						{kind === 'none' && (
							<div className="flex flex-col items-center gap-2 rounded-lg bg-muted py-10 text-muted-foreground">
								<FileIcon className="h-12 w-12" />
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

					{/* Link formats */}
					<div className="space-y-2">
						<p className="text-sm font-medium">复制链接</p>
						<div className="flex flex-wrap gap-2">
							{linkFormats.map((fmt) => (
								<Button
									key={fmt}
									variant="outline"
									size="sm"
									className="gap-1.5"
									onClick={() => copyLink(fmt)}
								>
									{copiedFmt === fmt ? (
										<Check className="h-3.5 w-3.5 text-green-600" />
									) : (
										<Clipboard className="h-3.5 w-3.5" />
									)}
									{FORMAT_LABELS[fmt]}
								</Button>
							))}
						</div>
					</div>

					{/* Actions */}
					<div className="mt-6 flex flex-wrap items-center gap-2 border-t pt-4">
						<Button
							variant="outline"
							size="sm"
							className="gap-1.5"
							onClick={() => {
								window.open(file.cdnUrl, '_blank')
							}}
						>
							<ExternalLink className="h-4 w-4" /> 新窗口打开
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="gap-1.5"
							onClick={async () => {
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
							}}
						>
							<Download className="h-4 w-4" /> 下载
						</Button>
						<div className="flex items-center gap-1.5">
							<FolderInput className="h-4 w-4 text-muted-foreground" />
							<Select value={file.folderId ?? 'root'} onValueChange={handleMove}>
								<SelectTrigger className="h-8 w-36">
									<SelectValue placeholder="移动到..." />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="root">根目录</SelectItem>
									{folders.map((f) => (
										<SelectItem key={f.id} value={f.id}>
											{f.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
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
