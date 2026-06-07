'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Download, ImageIcon, Loader2, Upload, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import ToolsLayout from './ToolsLayout'

type OutputFormat = 'image/jpeg' | 'image/webp' | 'image/png'

interface CompressResult {
	id: string
	name: string
	originalSize: number
	originalUrl: string
	compressedSize: number
	compressedUrl: string
	compressedBlob: Blob
	width: number
	height: number
	newWidth: number
	newHeight: number
}

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function getFormatLabel(mime: string): string {
	if (mime === 'image/jpeg') return 'JPEG'
	if (mime === 'image/webp') return 'WebP'
	return 'PNG'
}

function getExt(mime: string): string {
	if (mime === 'image/jpeg') return '.jpg'
	if (mime === 'image/webp') return '.webp'
	return '.png'
}

async function compressImage(
	file: File,
	format: OutputFormat,
	quality: number,
	maxWidth: number,
): Promise<Omit<CompressResult, 'id'>> {
	return new Promise((resolve, reject) => {
		const img = new Image()
		img.onload = () => {
			let { width, height } = img
			const originalUrl = URL.createObjectURL(file)

			// Scale down if maxWidth is set
			if (maxWidth > 0 && width > maxWidth) {
				const ratio = maxWidth / width
				width = maxWidth
				height = Math.round(height * ratio)
			}

			const canvas = document.createElement('canvas')
			canvas.width = width
			canvas.height = height
			const ctx = canvas.getContext('2d')!
			ctx.drawImage(img, 0, 0, width, height)

			canvas.toBlob(
				(blob) => {
					if (!blob) {
						reject(new Error('压缩失败'))
						return
					}
					resolve({
						name: file.name,
						originalSize: file.size,
						originalUrl,
						compressedSize: blob.size,
						compressedUrl: URL.createObjectURL(blob),
						compressedBlob: blob,
						width: img.width,
						height: img.height,
						newWidth: width,
						newHeight: height,
					})
				},
				format,
				quality,
			)
		}
		img.onerror = () => reject(new Error('图片加载失败'))
		img.src = URL.createObjectURL(file)
	})
}

export default function ToolCompressPage() {
	const [format, setFormat] = useState<OutputFormat>('image/jpeg')
	const [quality, setQuality] = useState(0.8)
	const [maxWidth, setMaxWidth] = useState(0)
	const [results, setResults] = useState<CompressResult[]>([])
	const [compressing, setCompressing] = useState(false)
	const [dragging, setDragging] = useState(false)
	const fileInputRef = useRef<HTMLInputElement>(null)

	const handleFiles = useCallback(
		async (files: FileList | File[]) => {
			const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
			if (imageFiles.length === 0) return

			setCompressing(true)
			try {
				const newResults: CompressResult[] = []
				for (const file of imageFiles) {
					try {
						const result = await compressImage(file, format, quality, maxWidth)
						newResults.push({ ...result, id: `${Date.now()}-${Math.random()}` })
					} catch (err) {
						console.error(`压缩 ${file.name} 失败:`, err)
					}
				}
				setResults((prev) => [...newResults, ...prev])
			} finally {
				setCompressing(false)
			}
		},
		[format, quality, maxWidth],
	)

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault()
			setDragging(false)
			handleFiles(e.dataTransfer.files)
		},
		[handleFiles],
	)

	const handleDownload = (result: CompressResult) => {
		const a = document.createElement('a')
		a.href = result.compressedUrl
		const baseName = result.name.replace(/\.[^.]+$/, '')
		a.download = `${baseName}_compressed${getExt(format)}`
		a.click()
	}

	const handleRemove = (id: string) => {
		setResults((prev) => {
			const r = prev.find((p) => p.id === id)
			if (r) {
				URL.revokeObjectURL(r.originalUrl)
				URL.revokeObjectURL(r.compressedUrl)
			}
			return prev.filter((p) => p.id !== id)
		})
	}

	return (
		<ToolsLayout currentPath="/briar-display/tools/compress" title="图片压缩">
			<div className="space-y-6">
				{/* 设置面板 */}
				<Card>
					<CardHeader className="pb-4">
						<CardTitle className="flex items-center gap-2 text-lg">
							<ImageIcon className="h-5 w-5" />
							图片压缩设置
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<div className="grid gap-4 sm:grid-cols-3">
								<div className="space-y-1.5">
									<Label>输出格式</Label>
									<div className="flex gap-2">
										{(
											[
												['image/jpeg', 'JPEG'],
												['image/webp', 'WebP'],
												['image/png', 'PNG'],
											] as [OutputFormat, string][]
										).map(([val, label]) => (
											<Button
												key={val}
												variant={format === val ? 'default' : 'outline'}
												size="sm"
												onClick={() => setFormat(val)}
											>
												{label}
											</Button>
										))}
									</div>
								</div>

								<div className="space-y-1.5">
									<Label>
										质量{' '}
										<span className="text-muted-foreground">({Math.round(quality * 100)}%)</span>
									</Label>
									<Slider
										min={10}
										max={100}
										step={1}
										value={[Math.round(quality * 100)]}
										onValueChange={([v]) => setQuality(v / 100)}
										className="w-full"
										disabled={format === 'image/png'}
									/>
								</div>

								<div className="space-y-1.5">
									<Label>最大宽度</Label>
									<div className="flex items-center gap-2">
										<Input
											type="number"
											value={maxWidth || ''}
											onChange={(e) => setMaxWidth(Number(e.target.value) || 0)}
											placeholder="不限制"
											className="w-28"
										/>
										<span className="text-sm text-muted-foreground">px</span>
									</div>
								</div>
							</div>
							{format === 'image/png' && (
								<p className="text-xs text-muted-foreground">PNG 为无损格式，质量设置不生效。</p>
							)}
						</div>
					</CardContent>
				</Card>

				{/* 上传区 */}
				<div
					onDrop={handleDrop}
					onDragOver={(e) => {
						e.preventDefault()
						setDragging(true)
					}}
					onDragLeave={() => setDragging(false)}
					onClick={() => fileInputRef.current?.click()}
					className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-12 transition-colors ${
						dragging
							? 'border-primary bg-primary/5'
							: 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
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
					{compressing ? (
						<Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
					) : (
						<Upload className="h-10 w-10 text-muted-foreground" />
					)}
					<div className="text-center">
						<p className="text-sm font-medium">
							{compressing ? '压缩中...' : '拖拽图片到此处，或点击上传'}
						</p>
						<p className="mt-1 text-xs text-muted-foreground">支持 PNG、JPEG、WebP、GIF</p>
					</div>
				</div>

				{/* 结果列表 */}
				{results.length > 0 && (
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<h3 className="text-sm font-medium">
								压缩结果
								<span className="ml-2 text-muted-foreground">({results.length})</span>
							</h3>
						</div>

						{results.map((r) => {
							const ratio = Math.round((1 - r.compressedSize / r.originalSize) * 100)
							const isBigger = r.compressedSize > r.originalSize
							return (
								<Card key={r.id}>
									<CardContent className="flex items-center gap-4 py-4">
										{/* 缩略图 */}
										<img
											src={r.compressedUrl}
											alt={r.name}
											className="h-16 w-16 rounded border object-contain"
										/>

										{/* 信息 */}
										<div className="min-w-0 flex-1">
											<p className="truncate text-sm font-medium">{r.name}</p>
											<p className="text-xs text-muted-foreground">
												{r.width}×{r.height}
												{r.newWidth !== r.width && (
													<span>
														{' '}
														→ {r.newWidth}×{r.newHeight}
													</span>
												)}
											</p>
										</div>

										{/* 大小对比 */}
										<div className="flex items-center gap-3 text-sm">
											<span className="text-muted-foreground">{formatSize(r.originalSize)}</span>
											<span className="text-muted-foreground">→</span>
											<span className="font-medium">{formatSize(r.compressedSize)}</span>
										</div>

										{/* 压缩率 */}
										<Badge
											variant="outline"
											className={
												isBigger ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'
											}
										>
											{isBigger ? `+${Math.abs(ratio)}%` : `-${ratio}%`}
										</Badge>

										{/* 操作 */}
										<div className="flex items-center gap-1">
											<Button
												variant="outline"
												size="sm"
												onClick={() => handleDownload(r)}
												className="gap-1"
											>
												<Download className="h-3.5 w-3.5" />
												下载
											</Button>
											<Button variant="ghost" size="sm" onClick={() => handleRemove(r.id)}>
												<X className="h-4 w-4" />
											</Button>
										</div>
									</CardContent>
								</Card>
							)
						})}
					</div>
				)}
			</div>
		</ToolsLayout>
	)
}
