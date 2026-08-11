'use client'

import { uploadFiles } from '@/api/files'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Clock, CloudUpload, Download, ImageIcon, Loader2, Trash2, Upload, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import UPNG from 'upng-js'
import ToolsLayout from './ToolsLayout'
import {
	type CompressHistoryEntry,
	clearCompressHistory,
	compressRatio,
	deleteCompressHistoryEntry,
	formatSize,
	generateThumbnail,
	getExtFromFormat,
	loadCompressHistory,
	pushCompressHistory,
} from './compressHistory'

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
	thumbnail: string
}

function formatSizeLocal(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
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
	pngColors: number,
): Promise<Omit<CompressResult, 'id'>> {
	return new Promise((resolve, reject) => {
		const img = new Image()
		img.onload = () => {
			let { width, height } = img
			const originalUrl = URL.createObjectURL(file)

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
			let thumbnail = ''
			try {
				thumbnail = generateThumbnail(canvas)
			} catch (e) {
				console.warn('缩略图生成失败:', e)
			}

			if (format === 'image/png') {
				const imageData = ctx.getImageData(0, 0, width, height)
				const pngBuf = UPNG.encode([imageData.data.buffer], width, height, pngColors)
				const blob = new Blob([pngBuf], { type: 'image/png' })
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
					thumbnail,
				})
			} else {
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
							thumbnail,
						})
					},
					format,
					quality,
				)
			}
		}
		img.onerror = () => reject(new Error('图片加载失败'))
		img.src = URL.createObjectURL(file)
	})
}

/** 获取当前用户 userId（从 localStorage 同步读取） */
function getUserId(): string {
	try {
		const raw = localStorage.getItem('briar_user')
		if (raw) {
			const u = JSON.parse(raw)
			if (u?.id) return u.id
		}
	} catch {}
	return 'default'
}

export default function ToolCompressPage() {
	const [format, setFormat] = useState<OutputFormat>('image/jpeg')
	const [quality, setQuality] = useState(0.8)
	const [pngColors, setPngColors] = useState(256)
	const [maxWidth, setMaxWidth] = useState(0)
	const [results, setResults] = useState<CompressResult[]>([])
	const [compressing, setCompressing] = useState(false)
	const [dragging, setDragging] = useState(false)
	const [history, setHistory] = useState<CompressHistoryEntry[]>([])
	const [uploadingId, setUploadingId] = useState<string | null>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)

	const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('briar_token')
	const userId = getUserId()

	// 加载历史记录（异步）
	useEffect(() => {
		if (!hasToken) return
		loadCompressHistory(userId).then(setHistory).catch(console.error)
	}, [hasToken, userId])

	const handleClearHistory = useCallback(async () => {
		await clearCompressHistory(userId)
		setHistory([])
	}, [userId])

	const handleDeleteEntry = useCallback(async (id: string) => {
		await deleteCompressHistoryEntry(id)
		setHistory((prev) => prev.filter((e) => e.id !== id))
	}, [])

	const handleFiles = useCallback(
		async (files: FileList | File[]) => {
			const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
			if (imageFiles.length === 0) return

			setCompressing(true)
			try {
				const newResults: CompressResult[] = []
				for (const file of imageFiles) {
					try {
						const result = await compressImage(file, format, quality, maxWidth, pngColors)
						const id = `${Date.now()}-${Math.random()}`
						newResults.push({ ...result, id })

						// 保存历史记录到 IndexedDB（仅已登录用户）
						if (hasToken) {
							try {
								const updated = await pushCompressHistory({
									id,
									userId,
									name: result.name,
									originalSize: result.originalSize,
									compressedSize: result.compressedSize,
									width: result.width,
									height: result.height,
									newWidth: result.newWidth,
									newHeight: result.newHeight,
									format,
									timestamp: Date.now(),
									blob: result.compressedBlob,
									thumbnail: result.thumbnail,
								})
								setHistory(updated)
							} catch (e) {
								console.warn('历史记录保存失败:', e)
							}
						}
					} catch (err) {
						console.error(`压缩 ${file.name} 失败:`, err)
					}
				}
				setResults((prev) => [...newResults, ...prev])
			} finally {
				setCompressing(false)
			}
		},
		[format, quality, maxWidth, pngColors, hasToken, userId],
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

	/** 从历史记录下载 */
	const handleHistoryDownload = (entry: CompressHistoryEntry) => {
		try {
			const url = URL.createObjectURL(entry.blob)
			const a = document.createElement('a')
			a.href = url
			const baseName = entry.name.replace(/\.[^.]+$/, '')
			a.download = `${baseName}_compressed${getExtFromFormat(entry.format)}`
			document.body.appendChild(a)
			a.click()
			document.body.removeChild(a)
			setTimeout(() => URL.revokeObjectURL(url), 1000)
		} catch (e) {
			console.error('下载失败:', e)
			toast.error('下载失败，请重试')
		}
	}

	/** 上传到文件管理 */
	const handleUploadToHost = useCallback(async (entry: CompressHistoryEntry) => {
		setUploadingId(entry.id)
		try {
			const ext = getExtFromFormat(entry.format)
			const baseName = entry.name.replace(/\.[^.]+$/, '')
			const file = new File([entry.blob], `${baseName}_compressed${ext}`, {
				type: entry.blob.type || entry.format,
			})
			const results = await uploadFiles([file])
			const uploaded = results[0]?.file
			if (uploaded) {
				const cdnUrl = uploaded.cdnUrl
				try {
					await navigator.clipboard.writeText(cdnUrl)
					toast.success('已上传并复制链接')
				} catch {
					toast.success(`已上传: ${cdnUrl}`)
				}
			} else {
				toast.error(results[0]?.error || '上传失败')
			}
		} catch (err: any) {
			toast.error(err?.response?.data?.message || '上传失败')
		} finally {
			setUploadingId(null)
		}
	}, [])

	const isPng = format === 'image/png'

	return (
		<ToolsLayout currentPath="/briar/tools/compress">
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

							{isPng ? (
								<div className="space-y-1.5">
									<Label>
										颜色数量 <span className="text-muted-foreground">({pngColors})</span>
									</Label>
									<div className="flex h-9 items-center">
										<Slider
											min={8}
											max={256}
											step={8}
											value={[pngColors]}
											onValueChange={([v]) => setPngColors(v)}
										/>
									</div>
									<p className="text-xs text-muted-foreground">
										越少体积越小，256 接近原图，64 适合图标/截图
									</p>
								</div>
							) : (
								<div className="space-y-1.5">
									<Label>
										质量{' '}
										<span className="text-muted-foreground">({Math.round(quality * 100)}%)</span>
									</Label>
									<div className="flex h-9 items-center">
										<Slider
											min={10}
											max={100}
											step={1}
											value={[Math.round(quality * 100)]}
											onValueChange={([v]) => setQuality(v / 100)}
										/>
									</div>
								</div>
							)}

							<div className="flex items-end gap-2">
								<div className="flex-1 space-y-1.5">
									<Label>最大宽度</Label>
									<Input
										type="number"
										value={maxWidth || ''}
										onChange={(e) => setMaxWidth(Number(e.target.value) || 0)}
										placeholder="不限制"
									/>
								</div>
								<span className="pb-2.5 text-sm text-muted-foreground">px</span>
							</div>
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
										<img
											src={r.compressedUrl}
											alt={r.name}
											className="h-16 w-16 rounded border object-contain"
										/>

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

										<div className="flex items-center gap-3 text-sm">
											<span className="text-muted-foreground">
												{formatSizeLocal(r.originalSize)}
											</span>
											<span className="text-muted-foreground">→</span>
											<span className="font-medium">{formatSizeLocal(r.compressedSize)}</span>
										</div>

										<Badge
											variant="outline"
											className={
												isBigger ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'
											}
										>
											{isBigger ? `+${Math.abs(ratio)}%` : `-${ratio}%`}
										</Badge>

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

				{/* 压缩历史（仅已登录用户，从 IndexedDB 读取） */}
				{hasToken && history.length > 0 && (
					<Card>
						<CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
							<CardTitle className="flex items-center gap-2 text-base">
								<Clock className="h-4 w-4" />
								压缩历史
								<span className="text-sm font-normal text-muted-foreground">
									({history.length})
								</span>
							</CardTitle>
							<Button variant="ghost" size="sm" onClick={handleClearHistory} className="gap-1">
								<Trash2 className="h-3.5 w-3.5" />
								清空
							</Button>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
								{history.map((entry) => {
									const ratio = compressRatio(entry.originalSize, entry.compressedSize)
									const isBigger = entry.compressedSize > entry.originalSize
									const isUploading = uploadingId === entry.id
									return (
										<div
											key={entry.id}
											className="group relative flex flex-col overflow-hidden rounded-md border bg-muted/30"
										>
											{/* 缩略图 */}
											{entry.thumbnail ? (
												<img
													src={entry.thumbnail}
													alt={entry.name}
													className="aspect-square w-full object-contain bg-white p-1"
												/>
											) : (
												<div className="flex aspect-square w-full items-center justify-center bg-muted">
													<ImageIcon className="h-6 w-6 text-muted-foreground" />
												</div>
											)}

											{/* 信息区 */}
											<div className="space-y-0.5 p-2 text-xs">
												<p className="truncate font-medium" title={entry.name}>
													{entry.name}
												</p>
												<p className="text-muted-foreground">
													{formatSize(entry.originalSize)} → {formatSize(entry.compressedSize)}
												</p>
												<p
													className={
														isBigger ? 'font-medium text-yellow-600' : 'font-medium text-green-600'
													}
												>
													{isBigger ? `+${Math.abs(ratio)}%` : `-${ratio}%`}
												</p>
											</div>

											{/* 操作按钮（hover 显示） */}
											<div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
												<Button
													variant="secondary"
													size="sm"
													className="h-7 w-7 p-0"
													title="下载"
													onClick={() => handleHistoryDownload(entry)}
												>
													<Download className="h-3.5 w-3.5" />
												</Button>
												<Button
													variant="secondary"
													size="sm"
													className="h-7 w-7 p-0"
													title="上传到图床"
													disabled={isUploading}
													onClick={() => handleUploadToHost(entry)}
												>
													{isUploading ? (
														<Loader2 className="h-3.5 w-3.5 animate-spin" />
													) : (
														<CloudUpload className="h-3.5 w-3.5" />
													)}
												</Button>
												<Button
													variant="secondary"
													size="sm"
													className="h-7 w-7 p-0"
													title="删除"
													onClick={() => handleDeleteEntry(entry.id)}
												>
													<X className="h-3.5 w-3.5" />
												</Button>
											</div>
										</div>
									)
								})}
							</div>
						</CardContent>
					</Card>
				)}
			</div>
		</ToolsLayout>
	)
}
