'use client'

import type { ImageItem } from '@/api/images'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Check, Clipboard, Download, ExternalLink, X } from 'lucide-react'
import { useState } from 'react'

type LinkFormat = 'url' | 'markdown' | 'html' | 'bbcode'

const FORMAT_LABELS: Record<LinkFormat, string> = {
	url: '直链',
	markdown: 'Markdown',
	html: 'HTML',
	bbcode: 'BBCode',
}

function getLink(item: ImageItem, fmt: LinkFormat): string {
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
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

interface Props {
	image: ImageItem
	onClose: () => void
	onDelete: (id: string) => void
}

export default function ImageDetailModal({ image, onClose, onDelete }: Props) {
	const [copiedFmt, setCopiedFmt] = useState<LinkFormat | null>(null)

	const copyLink = async (fmt: LinkFormat) => {
		await navigator.clipboard.writeText(getLink(image, fmt))
		setCopiedFmt(fmt)
		setTimeout(() => setCopiedFmt(null), 2000)
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
				<div className="sticky top-0 flex items-center justify-between border-b bg-background px-6 py-3">
					<h2 className="truncate text-sm font-medium">{image.originalName}</h2>
					<Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
						<X className="h-4 w-4" />
					</Button>
				</div>

				<div className="p-6">
					{/* Preview */}
					<div className="mb-6 flex justify-center rounded-lg bg-muted p-4">
						<img
							src={image.cdnUrl}
							alt={image.originalName}
							className="max-h-[50vh] max-w-full object-contain"
						/>
					</div>

					{/* Metadata */}
					<div className="mb-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
						<div>
							<p className="text-muted-foreground">大小</p>
							<p className="font-medium">{formatSize(image.size)}</p>
						</div>
						<div>
							<p className="text-muted-foreground">类型</p>
							<p className="font-medium">{image.mimeType}</p>
						</div>
						{image.width && image.height && (
							<div>
								<p className="text-muted-foreground">尺寸</p>
								<p className="font-medium">
									{image.width} × {image.height}
								</p>
							</div>
						)}
						<div>
							<p className="text-muted-foreground">上传时间</p>
							<p className="font-medium">{new Date(image.createdAt).toLocaleDateString('zh-CN')}</p>
						</div>
					</div>

					{/* Link formats */}
					<div className="space-y-2">
						<p className="text-sm font-medium">复制链接</p>
						<div className="flex flex-wrap gap-2">
							{(['url', 'markdown', 'html', 'bbcode'] as LinkFormat[]).map((fmt) => (
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
					<div className="mt-6 flex gap-2 border-t pt-4">
						<Button
							variant="outline"
							size="sm"
							className="gap-1.5"
							onClick={() => {
								const win = window.open('', '_blank')
								if (win) {
									win.document.write(
										`<!DOCTYPE html><html><head><title>${image.originalName}</title><style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#1a1a1a}img{max-width:100%;max-height:100vh;object-fit:contain}</style></head><body><img src="${image.cdnUrl}" alt="${image.originalName}" /></body></html>`,
									)
									win.document.close()
								}
							}}
						>
							<ExternalLink className="h-4 w-4" /> 新窗口打开
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="gap-1.5"
							onClick={() => {
								const a = document.createElement('a')
								a.href = image.cdnUrl
								a.download = image.originalName
								a.click()
							}}
						>
							<Download className="h-4 w-4" /> 下载
						</Button>
						<Button
							variant="destructive"
							size="sm"
							className="gap-1.5 ml-auto"
							onClick={() => {
								if (confirm('确定删除？')) onDelete(image.id)
							}}
						>
							<X className="h-4 w-4" /> 删除
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}
