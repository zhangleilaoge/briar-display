'use client'

import { type ImageItem, deleteImage, getImages } from '@/api/images'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { PermissionProvider } from '@/contexts/PermissionContext'
import { useRequirePermission } from '@/hooks/useRequirePermission'
import { PERMISSIONS } from '@briar/shared'
import { AlertCircle, Loader2, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import ImageDetailModal from './ImageDetailModal'
import ImageHostingLayout from './ImageHostingLayout'

const PAGE_SIZE = 24

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
	const [page, setPage] = useState(1)
	const [hasMore, setHasMore] = useState(false)
	const [loading, setLoading] = useState(true)
	const [loadingMore, setLoadingMore] = useState(false)
	const [search, setSearch] = useState('')
	const [keyword, setKeyword] = useState('')
	const [selected, setSelected] = useState<Set<string>>(new Set())
	const [detailImage, setDetailImage] = useState<ImageItem | null>(null)
	const debounceRef = useRef<ReturnType<typeof setTimeout>>()
	const sentinelRef = useRef<HTMLDivElement>(null)
	// 用 ref 记录当前页码，避免回调闭包拿到旧值
	const pageRef = useRef(1)
	const hasMoreRef = useRef(false)
	const loadingMoreRef = useRef(false)
	const keywordRef = useRef('')

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

	// 初始 / 关键词变化时重置
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
		setPage(next)
		fetchPage(keywordRef.current, next, true)
	}, [fetchPage])

	// 触底加载
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
		// 全选语义：选当前已加载的全部；再点一次清空
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
		// 重新拉第一页
		pageRef.current = 1
		setPage(1)
		fetchPage(keywordRef.current, 1, false)
	}

	const handleDeleteFromModal = async (id: string) => {
		await deleteImage(id)
		setDetailImage(null)
		pageRef.current = 1
		setPage(1)
		fetchPage(keywordRef.current, 1, false)
	}

	if (permLoading) {
		return (
			<ImageHostingLayout currentPath="/briar-display/images/gallery">
				<div className="flex items-center justify-center py-20">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			</ImageHostingLayout>
		)
	}

	if (denied) {
		return (
			<ImageHostingLayout currentPath="/briar-display/images/gallery">
				<div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
					<AlertCircle className="h-5 w-5" />
					<span>你没有权限访问此页面</span>
				</div>
			</ImageHostingLayout>
		)
	}

	return (
		<ImageHostingLayout currentPath="/briar-display/images/gallery">
			<div className="space-y-4">
				{/* Toolbar */}
				<div className="flex items-center justify-between gap-3">
					<div className="relative w-64">
						<Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							placeholder="搜索文件名..."
							value={search}
							onChange={(e) => handleSearchChange(e.target.value)}
							className="h-9 pl-8"
						/>
					</div>
					{selected.size > 0 && (
						<Button variant="destructive" size="sm" onClick={handleBulkDelete} className="gap-1.5">
							<Trash2 className="h-4 w-4" />
							删除 ({selected.size})
						</Button>
					)}
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
									<p className="mt-1 truncate text-xs text-muted-foreground">{img.originalName}</p>
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
