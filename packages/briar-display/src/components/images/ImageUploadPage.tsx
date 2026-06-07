'use client'

import { type ImageItem, uploadImages } from '@/api/images'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PermissionProvider } from '@/contexts/PermissionContext'
import { Check, Clipboard, Loader2, Upload } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import ImageHostingLayout from './ImageHostingLayout'

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

export default function ImageUploadPage() {
	const [uploading, setUploading] = useState(false)
	const [dragging, setDragging] = useState(false)
	const [uploaded, setUploaded] = useState<ImageItem[]>([])
	const [copiedId, setCopiedId] = useState<string | null>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)

	const handleFiles = useCallback(async (files: FileList | File[]) => {
		const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
		if (imageFiles.length === 0) return

		// Validate size
		const valid = imageFiles.filter((f) => {
			if (f.size > 10 * 1024 * 1024) {
				alert(`${f.name} 超过 10MB 限制`)
				return false
			}
			return true
		})
		if (valid.length === 0) return

		setUploading(true)
		try {
			const res = await uploadImages(valid)
			if (res.success && res.data) {
				setUploaded((prev) => [...res.data!, ...prev])
			} else {
				alert(res.message || '上传失败')
			}
		} catch (err: any) {
			alert(err?.response?.data?.message || '上传失败')
		} finally {
			setUploading(false)
		}
	}, [])

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault()
			setDragging(false)
			handleFiles(e.dataTransfer.files)
		},
		[handleFiles],
	)

	const handlePaste = useCallback(
		(e: React.ClipboardEvent) => {
			const files = Array.from(e.clipboardData.items)
				.filter((item) => item.type.startsWith('image/'))
				.map((item) => item.getAsFile())
				.filter(Boolean) as File[]
			if (files.length > 0) handleFiles(files)
		},
		[handleFiles],
	)

	const copyLink = useCallback(async (item: ImageItem, fmt: LinkFormat) => {
		await navigator.clipboard.writeText(getLink(item, fmt))
		setCopiedId(`${item.id}-${fmt}`)
		setTimeout(() => setCopiedId(null), 2000)
	}, [])

	return (
		<PermissionProvider>
			<ImageHostingLayout currentPath="/briar-display/images/upload">
				<div className="space-y-6">
					{/* Upload zone */}
					<button
						type="button"
						onDrop={handleDrop}
						onDragOver={(e) => {
							e.preventDefault()
							setDragging(true)
						}}
						onDragLeave={(e) => {
							if (!e.currentTarget.contains(e.relatedTarget as Node)) {
								setDragging(false)
							}
						}}
						onPaste={handlePaste}
						onClick={() => fileInputRef.current?.click()}
						className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-16 transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring ${
							dragging
								? 'border-primary bg-primary/5 scale-[1.01]'
								: 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
						}`}
					>
						<input
							ref={fileInputRef}
							type="file"
							accept="image/*"
							multiple
							className="hidden"
							onChange={(e) => {
								if (e.target.files) handleFiles(e.target.files)
								e.target.value = ''
							}}
						/>
						{uploading ? (
							<Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
						) : (
							<Upload className="h-12 w-12 text-muted-foreground/60" />
						)}
						<div className="text-center">
							<p className="text-base font-medium">
								{uploading ? '上传中...' : '拖拽、点击或粘贴图片到此处'}
							</p>
							<p className="mt-1 text-sm text-muted-foreground">
								支持 JPG、PNG、GIF、WebP、AVIF、SVG，单文件最大 10MB
							</p>
						</div>
					</button>

					{/* Uploaded results */}
					{uploaded.length > 0 && (
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<h3 className="text-sm font-medium">已上传 ({uploaded.length})</h3>
								<Button variant="ghost" size="sm" onClick={() => setUploaded([])}>
									清空列表
								</Button>
							</div>

							{uploaded.map((item) => (
								<Card key={item.id}>
									<CardContent className="flex items-start gap-4 py-4">
										<img
											src={item.thumbnailUrl || item.cdnUrl}
											alt={item.originalName}
											className="h-20 w-20 rounded-md border object-contain"
										/>
										<div className="min-w-0 flex-1 space-y-2">
											<p className="truncate text-sm font-medium">{item.originalName}</p>
											<p className="text-xs text-muted-foreground">
												{(item.size / 1024).toFixed(1)} KB · {item.mimeType}
											</p>
											<div className="flex flex-wrap gap-1.5">
												{(['url', 'markdown', 'html', 'bbcode'] as LinkFormat[]).map((fmt) => {
													const key = `${item.id}-${fmt}`
													return (
														<Button
															key={fmt}
															variant="outline"
															size="sm"
															className="h-7 gap-1 text-xs"
															onClick={() => copyLink(item, fmt)}
														>
															{copiedId === key ? (
																<Check className="h-3 w-3 text-green-600" />
															) : (
																<Clipboard className="h-3 w-3" />
															)}
															{FORMAT_LABELS[fmt]}
														</Button>
													)
												})}
											</div>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					)}
				</div>
			</ImageHostingLayout>
		</PermissionProvider>
	)
}
