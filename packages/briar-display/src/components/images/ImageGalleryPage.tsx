'use client'

import { type ImageItem, deleteImage, getImages } from '@/api/images'
import AdminPagination from '@/components/admin/AdminPagination'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { PermissionProvider } from '@/contexts/PermissionContext'
import { Loader2, Search, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import ImageDetailModal from './ImageDetailModal'
import ImageHostingLayout from './ImageHostingLayout'

const PAGE_SIZE = 24

export default function ImageGalleryPage() {
	const [images, setImages] = useState<ImageItem[]>([])
	const [total, setTotal] = useState(0)
	const [loading, setLoading] = useState(true)
	const [search, setSearch] = useState('')
	const [keyword, setKeyword] = useState('')
	const [page, setPage] = useState(1)
	const [selected, setSelected] = useState<Set<string>>(new Set())
	const [detailImage, setDetailImage] = useState<ImageItem | null>(null)
	const debounceRef = useRef<ReturnType<typeof setTimeout>>()

	const fetchImages = useCallback(async (kw: string, p: number) => {
		setLoading(true)
		try {
			const res = await getImages({ keyword: kw || undefined, page: p, pageSize: PAGE_SIZE })
			if (res.success && res.data) {
				setImages(res.data.items)
				setTotal(res.data.total)
			}
		} catch {
			/* ignore */
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		fetchImages(keyword, page)
	}, [keyword, page, fetchImages])

	const handleSearchChange = (value: string) => {
		setSearch(value)
		if (debounceRef.current) clearTimeout(debounceRef.current)
		debounceRef.current = setTimeout(() => {
			setKeyword(value)
			setPage(1)
		}, 300)
	}

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
		fetchImages(keyword, page)
	}

	const handleDeleteFromModal = async (id: string) => {
		await deleteImage(id)
		setDetailImage(null)
		fetchImages(keyword, page)
	}

	return (
		<PermissionProvider>
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
									<span className="text-xs text-muted-foreground">全选</span>
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
											className="aspect-square w-full overflow-hidden rounded-lg border bg-muted/30 transition-all hover:border-primary hover:shadow-md"
										>
											<img
												src={img.thumbnailUrl || img.cdnUrl}
												alt={img.originalName}
												className="h-full w-full object-cover"
												loading="lazy"
											/>
										</button>
										<p className="mt-1 truncate text-xs text-muted-foreground">
											{img.originalName}
										</p>
									</div>
								))}
							</div>

							{/* Pagination */}
							<AdminPagination
								total={total}
								limit={PAGE_SIZE}
								offset={(page - 1) * PAGE_SIZE}
								onPageChange={(offset) => setPage(Math.floor(offset / PAGE_SIZE) + 1)}
							/>
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
		</PermissionProvider>
	)
}
