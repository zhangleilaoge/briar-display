'use client'

import {
	type FileItem,
	type FileTypeFilter,
	type FolderItem,
	createFolder,
	deleteFile,
	deleteFolder,
	getFiles,
	getFolders,
	renameFolder,
	uploadFiles,
} from '@/api/files'
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PermissionProvider } from '@/contexts/PermissionContext'
import { useRequirePermission } from '@/hooks/useRequirePermission'
import { PERMISSIONS } from '@briar/shared'
import {
	AlertCircle,
	FileIcon,
	FileText,
	Folder as FolderIcon,
	FolderPlus,
	Loader2,
	Pencil,
	Play,
	Search,
	Trash2,
	Upload,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import FileDetailModal from './FileDetailModal'
import FileManagerLayout from './FileManagerLayout'

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

const TYPE_TABS: { value: '' | FileTypeFilter; label: string }[] = [
	{ value: '', label: '全部' },
	{ value: 'image', label: '图片' },
	{ value: 'video', label: '视频' },
	{ value: 'text', label: '文本' },
	{ value: 'other', label: '其他' },
]

interface UploadTask {
	name: string
	percent: number
	done: boolean
	error?: string
}

interface ConfirmState {
	title: string
	description: string
	onConfirm: () => void
}

export default function FileManagerPage() {
	return (
		<PermissionProvider>
			<FileManagerPageInner />
		</PermissionProvider>
	)
}

function FileManagerPageInner() {
	const { loading: permLoading, denied } = useRequirePermission(PERMISSIONS.PAGE_BUSINESS)
	const [files, setFiles] = useState<FileItem[]>([])
	const [folders, setFolders] = useState<FolderItem[]>([])
	const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
	const [typeFilter, setTypeFilter] = useState<'' | FileTypeFilter>('')
	const [total, setTotal] = useState(0)
	const [hasMore, setHasMore] = useState(false)
	const [loading, setLoading] = useState(true)
	const [loadingMore, setLoadingMore] = useState(false)
	const [search, setSearch] = useState('')
	const [keyword, setKeyword] = useState('')
	const [selected, setSelected] = useState<Set<string>>(new Set())
	const [detailFile, setDetailFile] = useState<FileItem | null>(null)
	const [uploadOpen, setUploadOpen] = useState(false)
	const [uploading, setUploading] = useState(false)
	const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([])
	const [dragging, setDragging] = useState(false)
	const [folderDialogOpen, setFolderDialogOpen] = useState(false)
	const [folderName, setFolderName] = useState('')
	const [renameTarget, setRenameTarget] = useState<FolderItem | null>(null)
	const [renameName, setRenameName] = useState('')
	const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
	const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
	const sentinelRef = useRef<HTMLDivElement>(null)
	const pageRef = useRef(1)
	const hasMoreRef = useRef(false)
	const loadingMoreRef = useRef(false)
	const fileInputRef = useRef<HTMLInputElement>(null)

	const refreshFolders = useCallback(async () => {
		try {
			const res = await getFolders()
			if (res.success && res.data) setFolders(res.data)
		} catch {
			/* ignore */
		}
	}, [])

	const fetchPage = useCallback(
		async (
			kw: string,
			folderId: string | null,
			type: '' | FileTypeFilter,
			p: number,
			append: boolean,
		) => {
			if (append) {
				setLoadingMore(true)
				loadingMoreRef.current = true
			} else {
				setLoading(true)
			}
			try {
				const res = await getFiles({
					keyword: kw || undefined,
					folderId,
					type: type || undefined,
					page: p,
					pageSize: PAGE_SIZE,
				})
				if (res.success && res.data) {
					setFiles((prev) => (append ? [...prev, ...res.data!.items] : res.data!.items))
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
		},
		[],
	)

	const refresh = useCallback(() => {
		pageRef.current = 1
		fetchPage(keyword, currentFolderId, typeFilter, 1, false)
	}, [fetchPage, keyword, currentFolderId, typeFilter])

	useEffect(() => {
		refreshFolders()
	}, [refreshFolders])

	useEffect(() => {
		pageRef.current = 1
		fetchPage(keyword, currentFolderId, typeFilter, 1, false)
	}, [keyword, currentFolderId, typeFilter, fetchPage])

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
		fetchPage(keyword, currentFolderId, typeFilter, next, true)
	}, [fetchPage, keyword, currentFolderId, typeFilter])

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

	// 当前文件夹的面包屑路径（根 → ... → 当前）
	const folderPath: FolderItem[] = []
	{
		let cursor = currentFolderId ? folders.find((f) => f.id === currentFolderId) : undefined
		while (cursor) {
			folderPath.unshift(cursor)
			cursor = cursor.parentId ? folders.find((f) => f.id === cursor!.parentId) : undefined
		}
	}

	// 当前文件夹下的子文件夹
	const subFolders = keyword ? [] : folders.filter((f) => (f.parentId ?? null) === currentFolderId)

	const toggleSelect = (id: string) => {
		setSelected((prev) => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	const toggleSelectAll = () => {
		if (selected.size === files.length) setSelected(new Set())
		else setSelected(new Set(files.map((i) => i.id)))
	}

	const handleBulkDelete = () => {
		setConfirmState({
			title: `删除 ${selected.size} 个文件`,
			description: '删除后不可恢复，确定继续？',
			onConfirm: async () => {
				for (const id of selected) {
					try {
						await deleteFile(id)
					} catch {
						/* ignore */
					}
				}
				toast.success('删除成功')
				setSelected(new Set())
				refresh()
			},
		})
	}

	const handleDeleteFromModal = async (id: string) => {
		setConfirmState({
			title: '删除文件',
			description: '删除后不可恢复，确定继续？',
			onConfirm: async () => {
				try {
					await deleteFile(id)
					toast.success('删除成功')
				} catch {
					toast.error('删除失败')
				}
				setDetailFile(null)
				refresh()
			},
		})
	}

	const handleCreateFolder = async () => {
		const name = folderName.trim()
		if (!name) return
		try {
			const res = await createFolder(name, currentFolderId)
			if (res.success) {
				toast.success('文件夹已创建')
				setFolderDialogOpen(false)
				setFolderName('')
				refreshFolders()
			} else {
				toast.error(res.message || '创建失败')
			}
		} catch (err: any) {
			toast.error(err?.response?.data?.message || '创建失败')
		}
	}

	const handleRenameFolder = async () => {
		if (!renameTarget) return
		const name = renameName.trim()
		if (!name) return
		try {
			const res = await renameFolder(renameTarget.id, name)
			if (res.success) {
				toast.success('重命名成功')
				setRenameTarget(null)
				refreshFolders()
			} else {
				toast.error(res.message || '重命名失败')
			}
		} catch {
			toast.error('重命名失败')
		}
	}

	const handleDeleteFolder = (folder: FolderItem) => {
		setConfirmState({
			title: `删除文件夹「${folder.name}」`,
			description: '文件夹内的所有子文件夹和文件将一并删除，不可恢复，确定继续？',
			onConfirm: async () => {
				try {
					const res = await deleteFolder(folder.id)
					if (res.success) {
						toast.success(res.message || '删除成功')
					} else {
						toast.error(res.message || '删除失败')
					}
				} catch {
					toast.error('删除失败')
				}
				refreshFolders()
				refresh()
			},
		})
	}

	/** 上传文件处理 */
	const handleUploadFiles = useCallback(
		async (fileList: FileList | File[]) => {
			const valid = Array.from(fileList)
			if (valid.length === 0) return

			setUploading(true)
			setUploadTasks(valid.map((f) => ({ name: f.name, percent: 0, done: false })))
			try {
				const results = await uploadFiles(valid, {
					folderId: currentFolderId,
					onProgress: (fileName, percent) => {
						setUploadTasks((prev) => prev.map((t) => (t.name === fileName ? { ...t, percent } : t)))
					},
				})
				setUploadTasks((prev) =>
					prev.map((t) => {
						const r = results.find((x) => x.name === t.name)
						return r
							? { ...t, percent: r.error ? t.percent : 100, done: true, error: r.error }
							: { ...t, done: true }
					}),
				)
				const deduped = results.filter((r) => r.deduplicated).length
				const failed = results.filter((r) => r.error).length
				const uploaded = results.length - deduped - failed
				if (failed > 0) {
					toast.error(`${failed} 个文件上传失败`)
				}
				if (uploaded > 0 || deduped > 0) {
					toast.success(
						deduped > 0
							? `已上传 ${uploaded} 个，${deduped} 个已存在（自动去重）`
							: `已上传 ${uploaded} 个文件`,
					)
				}
				refresh()
				if (failed === 0) {
					setUploadOpen(false)
					setUploadTasks([])
				}
			} catch (err: any) {
				toast.error(err?.message || '上传失败')
			} finally {
				setUploading(false)
			}
		},
		[currentFolderId, refresh],
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
			<FileManagerLayout>
				<div className="flex items-center justify-center py-20">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			</FileManagerLayout>
		)
	}

	if (denied) {
		return (
			<FileManagerLayout>
				<div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
					<AlertCircle className="h-5 w-5" />
					<span>你没有权限访问此页面</span>
				</div>
			</FileManagerLayout>
		)
	}

	return (
		<FileManagerLayout>
			<div className="space-y-4">
				{/* Toolbar */}
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex flex-wrap items-center gap-3">
						<div className="relative w-64">
							<Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="搜索文件名..."
								value={search}
								onChange={(e) => handleSearchChange(e.target.value)}
								className="h-9 pl-8"
							/>
						</div>
						<Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as '' | FileTypeFilter)}>
							<TabsList className="h-9">
								{TYPE_TABS.map((t) => (
									<TabsTrigger key={t.value} value={t.value} className="px-3 text-xs">
										{t.label}
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>
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
						<Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
							<DialogTrigger asChild>
								<Button variant="outline" size="sm" className="gap-1.5">
									<FolderPlus className="h-4 w-4" />
									新建文件夹
								</Button>
							</DialogTrigger>
							<DialogContent className="sm:max-w-sm">
								<DialogHeader>
									<DialogTitle>新建文件夹</DialogTitle>
								</DialogHeader>
								<div className="space-y-3">
									<Input
										placeholder="文件夹名"
										value={folderName}
										onChange={(e) => setFolderName(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === 'Enter') handleCreateFolder()
										}}
									/>
									<Button onClick={handleCreateFolder} className="w-full">
										创建
									</Button>
								</div>
							</DialogContent>
						</Dialog>
						<Dialog
							open={uploadOpen}
							onOpenChange={(open) => {
								if (!uploading) {
									setUploadOpen(open)
									if (!open) setUploadTasks([])
								}
							}}
						>
							<DialogTrigger asChild>
								<Button size="sm" className="gap-1.5">
									<Upload className="h-4 w-4" />
									上传
								</Button>
							</DialogTrigger>
							<DialogContent className="sm:max-w-md">
								<DialogHeader>
									<DialogTitle>上传文件</DialogTitle>
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
										const pasted = Array.from(e.clipboardData.items)
											.filter((item) => item.kind === 'file')
											.map((item) => item.getAsFile())
											.filter(Boolean) as File[]
										if (pasted.length > 0) handleUploadFiles(pasted)
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
											{uploading ? '上传中...' : '拖拽、点击或粘贴文件'}
										</p>
										<p className="mt-1 text-xs text-muted-foreground">
											支持任意类型文件，单文件最大 200MB
										</p>
									</div>
								</div>
								{uploadTasks.length > 0 && (
									<div className="mt-3 max-h-48 space-y-2 overflow-auto">
										{uploadTasks.map((t) => (
											<div key={t.name} className="space-y-1">
												<div className="flex items-center justify-between gap-2">
													<span className="truncate text-xs">{t.name}</span>
													<span
														className={`shrink-0 text-xs ${
															t.error ? 'text-destructive' : 'text-muted-foreground'
														}`}
													>
														{t.error ? '失败' : t.done ? '完成' : `${t.percent}%`}
													</span>
												</div>
												<div className="h-1 overflow-hidden rounded-full bg-muted">
													<div
														className={`h-full rounded-full transition-all ${
															t.error ? 'bg-destructive' : 'bg-primary'
														}`}
														style={{ width: `${t.error ? 100 : t.percent}%` }}
													/>
												</div>
											</div>
										))}
									</div>
								)}
							</DialogContent>
						</Dialog>
					</div>
				</div>

				{/* 文件夹路径面包屑 */}
				{!keyword && (
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem>
								{folderPath.length === 0 ? (
									<BreadcrumbPage>全部文件</BreadcrumbPage>
								) : (
									<BreadcrumbLink
										href="#"
										onClick={(e) => {
											e.preventDefault()
											setCurrentFolderId(null)
										}}
									>
										全部文件
									</BreadcrumbLink>
								)}
							</BreadcrumbItem>
							{folderPath.map((folder, idx) => (
								<span key={folder.id} className="contents">
									<BreadcrumbSeparator />
									<BreadcrumbItem>
										{idx === folderPath.length - 1 ? (
											<BreadcrumbPage>{folder.name}</BreadcrumbPage>
										) : (
											<BreadcrumbLink
												href="#"
												onClick={(e) => {
													e.preventDefault()
													setCurrentFolderId(folder.id)
												}}
											>
												{folder.name}
											</BreadcrumbLink>
										)}
									</BreadcrumbItem>
								</span>
							))}
						</BreadcrumbList>
					</Breadcrumb>
				)}

				{loading ? (
					<div className="flex items-center justify-center py-20">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : files.length === 0 && subFolders.length === 0 ? (
					<div className="py-20 text-center text-muted-foreground">
						{keyword ? '没有匹配的文件' : '这里还是空的，上传文件或新建文件夹吧'}
					</div>
				) : (
					<>
						{/* Grid */}
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
							{/* Select all */}
							{files.length > 0 && (
								<div className="col-span-full flex items-center gap-2 pb-1">
									<Checkbox
										checked={selected.size === files.length && files.length > 0}
										onCheckedChange={toggleSelectAll}
									/>
									<span className="text-xs text-muted-foreground">
										全选（已选 {selected.size} / 当前 {files.length}，共 {total}）
									</span>
								</div>
							)}

							{/* 文件夹卡片 */}
							{subFolders.map((folder) => (
								<div key={folder.id} className="group relative">
									<div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
										<button
											type="button"
											title="重命名"
											className="rounded-md bg-background/80 p-1 shadow-sm hover:bg-background"
											onClick={(e) => {
												e.stopPropagation()
												setRenameTarget(folder)
												setRenameName(folder.name)
											}}
										>
											<Pencil className="h-3.5 w-3.5" />
										</button>
										<button
											type="button"
											title="删除"
											className="rounded-md bg-background/80 p-1 shadow-sm hover:bg-background"
											onClick={(e) => {
												e.stopPropagation()
												handleDeleteFolder(folder)
											}}
										>
											<Trash2 className="h-3.5 w-3.5 text-destructive" />
										</button>
									</div>
									<button
										type="button"
										onClick={() => setCurrentFolderId(folder.id)}
										className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border bg-muted/50 transition-all hover:border-primary hover:shadow-md"
									>
										<FolderIcon className="h-12 w-12 text-yellow-500" />
									</button>
									<div className="mt-1">
										<p className="truncate text-xs font-medium" title={folder.name}>
											{folder.name}
										</p>
										<p className="text-[11px] text-muted-foreground">文件夹</p>
									</div>
								</div>
							))}

							{/* 文件卡片 */}
							{files.map((file) => (
								<div key={file.id} className="group relative">
									<div className="absolute left-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100">
										<Checkbox
											checked={selected.has(file.id)}
											onCheckedChange={() => toggleSelect(file.id)}
										/>
									</div>
									<button
										type="button"
										onClick={() => setDetailFile(file)}
										className="relative aspect-square w-full overflow-hidden rounded-lg border bg-muted transition-all hover:border-primary hover:shadow-md"
									>
										{file.mimeType.startsWith('image/') ? (
											<img
												src={file.thumbnailUrl || file.cdnUrl}
												alt={file.originalName}
												className="h-full w-full object-cover"
												loading="lazy"
											/>
										) : file.mimeType.startsWith('video/') ? (
											<>
												<video
													src={file.cdnUrl}
													preload="metadata"
													muted
													className="h-full w-full object-cover"
												/>
												<span className="absolute inset-0 flex items-center justify-center">
													<span className="rounded-full bg-black/50 p-2">
														<Play className="h-5 w-5 text-white" />
													</span>
												</span>
											</>
										) : (
											<span className="flex h-full w-full items-center justify-center">
												{file.mimeType.startsWith('text/') ||
												file.mimeType === 'application/json' ? (
													<FileText className="h-12 w-12 text-muted-foreground/60" />
												) : (
													<FileIcon className="h-12 w-12 text-muted-foreground/60" />
												)}
											</span>
										)}
									</button>
									<div className="mt-1 space-y-0.5">
										<p className="truncate text-xs font-medium" title={file.originalName}>
											{file.originalName}
										</p>
										<p className="truncate text-[11px] text-muted-foreground">
											{formatSize(file.size)} · {file.mimeType} · {formatDate(file.createdAt)}
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
						{!hasMore && files.length > 0 && (
							<div className="py-6 text-center text-xs text-muted-foreground">没有更多了</div>
						)}
					</>
				)}
			</div>

			{/* Detail modal */}
			{detailFile && (
				<FileDetailModal
					file={detailFile}
					folders={folders}
					onClose={() => setDetailFile(null)}
					onDelete={handleDeleteFromModal}
					onMoved={() => {
						setDetailFile(null)
						refresh()
					}}
				/>
			)}

			{/* Rename folder dialog */}
			<Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
				<DialogContent className="sm:max-w-sm">
					<DialogHeader>
						<DialogTitle>重命名文件夹</DialogTitle>
					</DialogHeader>
					<div className="space-y-3">
						<Input
							value={renameName}
							onChange={(e) => setRenameName(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter') handleRenameFolder()
							}}
						/>
						<Button onClick={handleRenameFolder} className="w-full">
							保存
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			{/* Confirm dialog */}
			<Dialog open={!!confirmState} onOpenChange={(open) => !open && setConfirmState(null)}>
				<DialogContent className="sm:max-w-sm">
					<DialogHeader>
						<DialogTitle>{confirmState?.title}</DialogTitle>
					</DialogHeader>
					<p className="text-sm text-muted-foreground">{confirmState?.description}</p>
					<div className="flex justify-end gap-2">
						<Button variant="outline" size="sm" onClick={() => setConfirmState(null)}>
							取消
						</Button>
						<Button
							variant="destructive"
							size="sm"
							onClick={() => {
								confirmState?.onConfirm()
								setConfirmState(null)
							}}
						>
							确定
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</FileManagerLayout>
	)
}
