'use client'

import { type ImageItem, deleteImage, getImages, uploadImages } from '@/api/images'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { PermissionProvider } from '@/contexts/PermissionContext'
import { useRequirePermission } from '@/hooks/useRequirePermission'
import { PERMISSIONS } from '@briar/shared'
import { AlertCircle, Loader2, Search, Trash2, Upload } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import ImageDetailModal from './ImageDetailModal'
import ImageHostingLayout from './ImageHostingLayout'

const PAGE_SIZE = 24

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string): string {
	const d = new Date(dateStr)
	return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

export default function ImageGalleryPage() {
	return (
		<PermissionProvider>
			<ImageGalleryPageInner />
		</PermissionProvider>
	)
}

function ImageGalleryPageInner() {
	const { loading: permLoading, denied } = useRequirePermission(PERMISSIONS.PAGE_BUSINESS)
	const [images, setImages] = useState<ImageItem[]>([])
	const [total, setTotal] = useState(0)
	const [hasMore, setHasMore] = useState(false)
	const [loading, setLoading] = useState(true)
	const [loadingMore, setLoadingMore] = useState(false)
	const [search, setSearch] = useState('')
	const [keyword, setKeyword] = useState('')
	const [selected, setSelected] = useState<Set<string>>(new Set())
	const [detailImage, setDetailImage] = useState<ImageItem | null>(null)
	const [uploadOpen, setUploadOpen] = useState(false)
	const [uploading, setUploading] = useState(false)
	const [dragging, setDragging] = useState(false)
	const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
	const sentinelRef = useRef<HTMLDivElement>(null)
	const pageRef = useRef(1)
	const hasMoreRef = useRef(false)
	const loadingMoreRef = useRef(false)
	const keywordRef = useRef('')
	const fileInputRef = useRef<HTMLInputElement>(null)

	const fetchPage = useCallback(async (kw: string, p: number, append: boolean) => {
		if (append) {
			setLoadingMore(true)
			loadingMoreRef.current = true
		} else {
			setLoading(true)
		}
		try {
			const res = await getImages({ keyword: kw || undefined, page: p, pageSize: PAGE_SIZE })
			if (res.success && res.data) {
				setImages((prev) => (append ? [...prev, ...res.data!.items] : res.data!.items))
				setTotal(res.data.total)
				const nextHasMore = p * PAGE_SIZE < res.data.total
				setHasMore(nextHasMore)
				hasMoreRef.current = nextHasMore
			}
		} catch {
			/* ignore */
		} finally {
			if (append) {
				setLoadingMore(false)
				loadingMoreRef.current = false
			} else {
				setLoading(false)
			}
		}
	}, [])

	useEffect(() => {
		pageRef.current = 1
		keywordRef.current = keyword
		fetchPage(keyword, 1, false)
	}, [keyword, fetchPage])

	const handleSearchChange = (value: string) => {
		setSearch(value)
		if (debounceRef.current) clearTimeout(debounceRef.current)
		debounceRef.current = setTimeout(() => {
			setKeyword(value)
		}, 300)
	}

	const loadMore = useCallback(() => {
		if (loadingMoreRef.current || !hasMoreRef.current) return
		const next = pageRef.current + 1
		pageRef.current = next
		fetchPage(keywordRef.current, next, true)
	}, [fetchPage])

	useEffect(() => {
		const el = sentinelRef.current
		if (!el) return
		const io = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) loadMore()
				}
			},
			{ rootMargin: '200px' },
		)
		io.observe(el)
		return () => io.disconnect()
	}, [loadMore])

	const toggleSelect = (id: string) => {
		setSelected((prev) => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	const toggleSelectAll = () => {
		if (selected.size === images.length) setSelected(new Set())
		else setSelected(new Set(images.map((i) => i.id)))
	}

	const handleBulkDelete = async () => {
		if (!confirm(`确定删除 ${selected.size} 张图片？`)) return
		for (const id of selected) {
			try {
				await deleteImage(id)
			} catch {
				/* ignore */
			}
		}
		setSelected(new Set())
		pageRef.current = 1
		fetchPage(keywordRef.current, 1, false)
	}

	const handleDeleteFromModal = async (id: string) => {
		await deleteImage(id)
		setDetailImage(null)
		pageRef.current = 1
		fetchPage(keywordRef.current, 1, false)
	}

	/** 上传文件处理 */
	const handleUploadFiles = useCallback(
		async (files: FileList | File[]) => {
			const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
			if (imageFiles.length === 0) return

			const valid = imageFiles.filter((f) => {
				if (f.size > 10 * 1024 * 1024) {
					toast.error(`${f.name} 超过 10MB 限制`)
					return false
				}
				return true
			})
			if (valid.length === 0) return

			setUploading(true)
			try {
				const res = await uploadImages(valid)
				if (res.success && res.data) {
					const deduped = res.data.filter((item: any) => item.deduplicated).length
					const uploaded = res.data.length - deduped
					if (deduped > 0 && uploaded > 0) {
						toast.success(`已上传 ${uploaded} 张，${deduped} 张已存在（自动去重）`)
					} else if (deduped > 0) {
						toast.info(`${deduped} 张图片已存在，无需重复上传`)
					} else {
						toast.success(`已上传 ${uploaded} 张图片`)
					}
					setUploadOpen(false)
					// 刷新列表
					pageRef.current = 1
					fetchPage(keywordRef.current, 1, false)
				} else {
					toast.error(res.message || '上传失败')
				}
			} catch (err: any) {
				toast.error(err?.response?.data?.message || '上传失败')
			} finally {
				setUploading(false)
			}
		},
		[fetchPage],
	)

	const handleUploadDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault()
			setDragging(false)
			handleUploadFiles(e.dataTransfer.files)
		},
		[handleUploadFiles],
	)

	if (permLoading) {
		return (
			<ImageHostingLayout>
				<div className="flex items-center justify-center py-20">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			</ImageHostingLayout>
		)
	}

	if (denied) {
		return (
			<ImageHostingLayout>
				<div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
					<AlertCircle className="h-5 w-5" />
					<span>你没有权限访问此页面</span>
				</div>
			</ImageHostingLayout>
		)
	}

	return (
		<ImageHostingLayout>
			<div className="space-y-4">
				{/* Toolbar */}
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-3">
						<div className="relative w-64">
							<Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="搜索文件名..."
								value={search}
								onChange={(e) => handleSearchChange(e.target.value)}
								className="h-9 pl-8"
							/>
						</div>
					</div>
					<div className="flex items-center gap-2">
						{selected.size > 0 && (
							<Button
								variant="destructive"
								size="sm"
								onClick={handleBulkDelete}
								className="gap-1.5"
							>
								<Trash2 className="h-4 w-4" />
								删除 ({selected.size})
							</Button>
						)}
						<Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
							<DialogTrigger asChild>
								<Button size="sm" className="gap-1.5">
									<Upload className="h-4 w-4" />
									上传
								</Button>
							</DialogTrigger>
							<DialogContent className="sm:max-w-md">
								<DialogHeader>
									<DialogTitle>上传图片</DialogTitle>
								</DialogHeader>
								<div
									onDrop={handleUploadDrop}
									onDragOver={(e) => {
										e.preventDefault()
										setDragging(true)
									}}
									onDragLeave={(e) => {
										if (!e.currentTarget.contains(e.relatedTarget as Node)) {
											setDragging(false)
										}
									}}
									onPaste={(e) => {
										const files = Array.from(e.clipboardData.items)
											.filter((item) => item.type.startsWith('image/'))
											.map((item) => item.getAsFile())
											.filter(Boolean) as File[]
										if (files.length > 0) handleUploadFiles(files)
									}}
									onClick={() => fileInputRef.current?.click()}
									className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-all ${
										dragging
											? 'border-primary bg-primary/5'
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
											if (e.target.files) handleUploadFiles(e.target.files)
											e.target.value = ''
										}}
									/>
									{uploading ? (
										<Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
									) : (
										<Upload className="h-10 w-10 text-muted-foreground/60" />
									)}
									<div className="text-center">
										<p className="text-sm font-medium">
											{uploading ? '上传中...' : '拖拽、点击或粘贴图片'}
										</p>
										<p className="mt-1 text-xs text-muted-foreground">
											支持 JPG、PNG、GIF、WebP、AVIF、SVG，单文件最大 10MB
										</p>
									</div>
								</div>
							</DialogContent>
						</Dialog>
					</div>
				</div>

				{loading ? (
					<div className="flex items-center justify-center py-20">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : images.length === 0 ? (
					<div className="py-20 text-center text-muted-foreground">
						{keyword ? '没有匹配的图片' : '还没有上传图片'}
					</div>
				) : (
					<>
						{/* Grid */}
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
							{/* Select all */}
							<div className="col-span-full flex items-center gap-2 pb-1">
								<Checkbox
									checked={selected.size === images.length && images.length > 0}
									onCheckedChange={toggleSelectAll}
								/>
								<span className="text-xs text-muted-foreground">
									全选（已选 {selected.size} / 当前 {images.length}，共 {total}）
								</span>
							</div>

							{images.map((img) => (
								<div key={img.id} className="group relative">
									<div className="absolute left-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100">
										<Checkbox
											checked={selected.has(img.id)}
											onCheckedChange={() => toggleSelect(img.id)}
										/>
									</div>
									<button
										type="button"
										onClick={() => setDetailImage(img)}
										className="aspect-square w-full overflow-hidden rounded-lg border bg-muted transition-all hover:border-primary hover:shadow-md"
									>
										<img
											src={img.thumbnailUrl || img.cdnUrl}
											alt={img.originalName}
											className="h-full w-full object-cover"
											loading="lazy"
										/>
									</button>
									<div className="mt-1 space-y-0.5">
										<p className="truncate text-xs font-medium" title={img.originalName}>
											{img.originalName}
										</p>
										<p className="truncate text-[11px] text-muted-foreground">
											{formatSize(img.size)} · {img.mimeType} · {formatDate(img.createdAt)}
										</p>
									</div>
								</div>
							))}
						</div>

						{/* Infinite scroll sentinel */}
						<div ref={sentinelRef} className="h-1" />
						{loadingMore && (
							<div className="flex items-center justify-center py-6">
								<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
							</div>
						)}
						{!hasMore && images.length > 0 && (
							<div className="py-6 text-center text-xs text-muted-foreground">没有更多了</div>
						)}
					</>
				)}
			</div>

			{/* Detail modal */}
			{detailImage && (
				<ImageDetailModal
					image={detailImage}
					onClose={() => setDetailImage(null)}
					onDelete={handleDeleteFromModal}
				/>
			)}
		</ImageHostingLayout>
	)
}
