'use client'

import { uploadFiles } from '@/api/files'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
import { File as FileIcon, Loader2, Upload, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

interface UploadTask {
	name: string
	percent: number
	done: boolean
	error?: string
}

interface PendingItem {
	id: string
	file: File
	/** 图片/视频本地预览 URL（object URL），卸载时 revoke */
	previewUrl?: string
}

interface UploadDialogProps {
	/** 上传到哪个文件夹（null = 根目录） */
	folderId: string | null
	/** 上传完成后回调（用于刷新列表） */
	onUploaded: () => void
}

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function isImageFile(file: File): boolean {
	return file.type.startsWith('image/')
}

function isVideoFile(file: File): boolean {
	return file.type.startsWith('video/')
}

function canPreviewFile(file: File): boolean {
	return isImageFile(file) || isVideoFile(file)
}

function makePreviewUrl(file: File): string | undefined {
	if (!canPreviewFile(file)) return undefined
	return URL.createObjectURL(file)
}

/** 用新文件名包一层 File（File.name 不可变） */
function renameFile(file: File, newName: string): File {
	const trimmed = newName.trim()
	if (!trimmed || trimmed === file.name) return file
	return new File([file], trimmed, { type: file.type, lastModified: file.lastModified })
}

function revokePreview(url?: string) {
	if (url) URL.revokeObjectURL(url)
}

/** 上传按钮 + 对话框（页面级粘贴/拖拽自动唤起；拖拽/点击/粘贴先暂存，点「开始上传」后分片直传 COS，逐文件进度） */
export default function UploadDialog({ folderId, onUploaded }: UploadDialogProps) {
	const [open, setOpen] = useState(false)
	const [uploading, setUploading] = useState(false)
	const [pending, setPending] = useState<PendingItem[]>([])
	const [tasks, setTasks] = useState<UploadTask[]>([])
	const [dragging, setDragging] = useState(false)
	const [pageDragging, setPageDragging] = useState(false)
	const [previewItem, setPreviewItem] = useState<PendingItem | null>(null)
	const [renamingId, setRenamingId] = useState<string | null>(null)
	const [renameDraft, setRenameDraft] = useState('')
	const fileInputRef = useRef<HTMLInputElement>(null)
	const renameInputRef = useRef<HTMLInputElement>(null)
	const pendingRef = useRef(pending)
	pendingRef.current = pending

	// 卸载时释放全部 object URL
	useEffect(() => {
		return () => {
			for (const p of pendingRef.current) revokePreview(p.previewUrl)
		}
	}, [])

	useEffect(() => {
		if (renamingId) {
			renameInputRef.current?.focus()
			renameInputRef.current?.select()
		}
	}, [renamingId])

	// 拖拽/选择/粘贴只进暂存列表，不上传；同名同大小去重
	const stageFiles = useCallback((fileList: FileList | File[]) => {
		const files = Array.from(fileList)
		if (files.length === 0) return
		setPending((prev) => {
			const seen = new Set(prev.map((p) => `${p.file.name}:${p.file.size}`))
			const added = files
				.filter((f) => !seen.has(`${f.name}:${f.size}`))
				.map((f) => ({
					id: `${Date.now()}-${Math.random()}`,
					file: f,
					previewUrl: makePreviewUrl(f),
				}))
			return [...prev, ...added]
		})
	}, [])

	const removePending = useCallback(
		(id: string) => {
			setPending((prev) => {
				const target = prev.find((p) => p.id === id)
				revokePreview(target?.previewUrl)
				return prev.filter((p) => p.id !== id)
			})
			setPreviewItem((cur) => (cur?.id === id ? null : cur))
			if (renamingId === id) setRenamingId(null)
		},
		[renamingId],
	)

	const clearPending = useCallback(() => {
		setPending((prev) => {
			for (const p of prev) revokePreview(p.previewUrl)
			return []
		})
		setPreviewItem(null)
		setRenamingId(null)
	}, [])

	const startRename = useCallback((item: PendingItem) => {
		setRenamingId(item.id)
		setRenameDraft(item.file.name)
	}, [])

	const commitRename = useCallback(() => {
		if (!renamingId) return
		const draft = renameDraft.trim()
		setPending((prev) =>
			prev.map((p) => {
				if (p.id !== renamingId) return p
				if (!draft || draft === p.file.name) return p
				return { ...p, file: renameFile(p.file, draft) }
			}),
		)
		setRenamingId(null)
	}, [renamingId, renameDraft])

	const cancelRename = useCallback(() => {
		setRenamingId(null)
	}, [])

	const handleConfirmUpload = useCallback(async () => {
		if (pending.length === 0) return
		const files = pending.map((p) => p.file)
		setUploading(true)
		setTasks(files.map((f) => ({ name: f.name, percent: 0, done: false })))
		try {
			const results = await uploadFiles(files, {
				folderId,
				onProgress: (fileName, percent) => {
					setTasks((prev) => prev.map((t) => (t.name === fileName ? { ...t, percent } : t)))
				},
			})
			setTasks((prev) =>
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
			onUploaded()
			// 失败的保留在暂存列表可重试，成功的移除并释放预览 URL
			const failedNames = new Set(results.filter((r) => r.error).map((r) => r.name))
			setPending((prev) => {
				const keep: PendingItem[] = []
				for (const p of prev) {
					if (failedNames.has(p.file.name)) keep.push(p)
					else revokePreview(p.previewUrl)
				}
				return keep
			})
			if (failed === 0) {
				setOpen(false)
				setTasks([])
				setPreviewItem(null)
			}
		} catch (err: any) {
			toast.error(err?.message || '上传失败')
		} finally {
			setUploading(false)
		}
	}, [pending, folderId, onUploaded])

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault()
			setDragging(false)
			stageFiles(e.dataTransfer.files)
		},
		[stageFiles],
	)

	// 剪贴板粘贴上传：div 的 onPaste 依赖焦点（div 不可聚焦时收不到），
	// 改为 document 级常驻监听；弹窗未打开时粘贴文件会自动唤起弹窗
	useEffect(() => {
		const onPaste = (e: ClipboardEvent) => {
			const target = e.target as HTMLElement | null
			// 不抢文本输入框自身的粘贴行为
			if (target?.closest('input, textarea, [contenteditable="true"]')) return
			const pasted = Array.from(e.clipboardData?.items ?? [])
				.filter((item) => item.kind === 'file')
				.map((item) => item.getAsFile())
				.filter(Boolean) as File[]
			if (pasted.length > 0) {
				e.preventDefault()
				setOpen(true)
				stageFiles(pasted)
			}
		}
		document.addEventListener('paste', onPaste)
		return () => document.removeEventListener('paste', onPaste)
	}, [stageFiles])

	// 页面级拖拽上传：操作系统文件拖到页面任意位置，唤起弹窗并暂存。
	// 只认外部文件拖拽（types 含 Files），不影响页面内「移动文件到文件夹」的自定义拖拽
	// （application/x-briar-file-id）。弹窗打开时落到弹窗拖拽区的 drop 会冒泡到这里，
	// 靠 stageFiles 的同名同大小去重避免重复暂存。
	useEffect(() => {
		let depth = 0
		// 站内「拖文件进文件夹」也会带 Files 类型；有自定义 mime 时不当作外部上传
		const hasFiles = (e: DragEvent) => {
			const types = Array.from(e.dataTransfer?.types ?? [])
			if (types.includes('application/x-briar-file-id')) return false
			return types.includes('Files')
		}
		const onDragEnter = (e: DragEvent) => {
			if (!hasFiles(e)) return
			depth += 1
			setPageDragging(true)
		}
		const onDragOver = (e: DragEvent) => {
			// 必须阻止默认行为，浏览器才会允许 drop（否则会直接打开/下载拖入的文件）
			if (hasFiles(e)) e.preventDefault()
		}
		const onDragLeave = (e: DragEvent) => {
			if (!hasFiles(e)) return
			depth = Math.max(0, depth - 1)
			if (depth === 0) setPageDragging(false)
		}
		const onDrop = (e: DragEvent) => {
			if (!hasFiles(e)) return
			e.preventDefault()
			depth = 0
			setPageDragging(false)
			const files = Array.from(e.dataTransfer?.files ?? [])
			if (files.length > 0) {
				setOpen(true)
				stageFiles(files)
			}
		}
		window.addEventListener('dragenter', onDragEnter)
		window.addEventListener('dragover', onDragOver)
		window.addEventListener('dragleave', onDragLeave)
		window.addEventListener('drop', onDrop)
		return () => {
			window.removeEventListener('dragenter', onDragEnter)
			window.removeEventListener('dragover', onDragOver)
			window.removeEventListener('dragleave', onDragLeave)
			window.removeEventListener('drop', onDrop)
		}
	}, [stageFiles])

	return (
		<>
			{/* 页面级拖拽提示遮罩（pointer-events-none，不拦截 dragleave/drop） */}
			{pageDragging && !open && (
				<div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
					<div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary bg-card px-12 py-10 shadow-lg">
						<Upload className="h-10 w-10 text-primary" />
						<p className="text-sm font-medium">松开鼠标，添加到上传列表</p>
					</div>
				</div>
			)}
			{/* 暂存文件预览（图片/视频） */}
			<Dialog
				open={Boolean(previewItem?.previewUrl)}
				onOpenChange={(next) => {
					if (!next) setPreviewItem(null)
				}}
			>
				<DialogContent className="max-w-[90vw] border-none bg-transparent p-0 shadow-none sm:max-w-[90vw]">
					<DialogHeader className="sr-only">
						<DialogTitle>{previewItem?.file.name ?? '文件预览'}</DialogTitle>
					</DialogHeader>
					{previewItem?.previewUrl && (
						<div className="flex flex-col items-center">
							{isImageFile(previewItem.file) ? (
								<img
									src={previewItem.previewUrl}
									alt={previewItem.file.name}
									className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
								/>
							) : (
								// biome-ignore lint/a11y/useMediaCaption: 用户本地上传预览，无字幕文件
								<video
									src={previewItem.previewUrl}
									controls
									autoPlay
									className="max-h-[85vh] max-w-[90vw] rounded-lg"
								/>
							)}
							<p className="mt-2 truncate text-center text-sm text-white/90">
								{previewItem.file.name}
							</p>
						</div>
					)}
				</DialogContent>
			</Dialog>
			<Dialog
				open={open}
				onOpenChange={(next) => {
					if (!uploading) {
						setOpen(next)
						if (!next) {
							setTasks([])
							setPreviewItem(null)
							setRenamingId(null)
						}
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
						onClick={() => fileInputRef.current?.click()}
						className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-all ${
							dragging
								? 'border-primary bg-primary/5'
								: 'border-muted-foreground/25 bg-muted/40 hover:border-primary/50 hover:bg-muted/60'
						}`}
					>
						<input
							ref={fileInputRef}
							type="file"
							multiple
							className="hidden"
							// 阻止 input 的程序化 click 冒泡回外层区域再次触发 onClick，
							// 否则重入的 input.click() 会被浏览器拦截，导致文件选择框打不开
							onClick={(e) => e.stopPropagation()}
							onChange={(e) => {
								if (e.target.files) stageFiles(e.target.files)
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
								{uploading ? '上传中...' : '拖拽、点击或粘贴文件到此处'}
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								支持任意类型文件，单文件最大 200MB
							</p>
						</div>
					</div>

					{/* 暂存列表：确认前可增删、预览、重命名 */}
					{pending.length > 0 && !uploading && (
						<div className="mt-3 space-y-3">
							<div className="max-h-48 space-y-1.5 overflow-auto">
								{pending.map((p) => (
									<div
										key={p.id}
										className="flex items-center gap-2 rounded-md border bg-card px-3 py-2"
									>
										{p.previewUrl && isImageFile(p.file) ? (
											<button
												type="button"
												onClick={() => setPreviewItem(p)}
												className="h-8 w-8 shrink-0 overflow-hidden rounded border bg-muted"
												title="预览"
											>
												<img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
											</button>
										) : p.previewUrl && isVideoFile(p.file) ? (
											<button
												type="button"
												onClick={() => setPreviewItem(p)}
												className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted"
												title="预览"
											>
												<video
													src={p.previewUrl}
													muted
													playsInline
													className="h-full w-full object-cover"
												/>
											</button>
										) : (
											<FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
										)}
										{renamingId === p.id ? (
											<input
												ref={renameInputRef}
												value={renameDraft}
												onChange={(e) => setRenameDraft(e.target.value)}
												onBlur={commitRename}
												onKeyDown={(e) => {
													if (e.key === 'Enter') {
														e.preventDefault()
														commitRename()
													} else if (e.key === 'Escape') {
														e.preventDefault()
														cancelRename()
													}
												}}
												className="min-w-0 flex-1 rounded border bg-background px-1.5 py-0.5 text-xs outline-none ring-1 ring-primary"
											/>
										) : (
											<button
												type="button"
												onClick={() => startRename(p)}
												className="min-w-0 flex-1 truncate text-left text-xs hover:underline"
												title="点击重命名"
											>
												{p.file.name}
											</button>
										)}
										<span className="shrink-0 text-xs text-muted-foreground">
											{formatSize(p.file.size)}
										</span>
										<button
											type="button"
											onClick={() => removePending(p.id)}
											className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
											title="移除"
										>
											<X className="h-3.5 w-3.5" />
										</button>
									</div>
								))}
							</div>
							<div className="flex justify-end gap-2">
								<Button variant="outline" size="sm" onClick={clearPending}>
									清空
								</Button>
								<Button size="sm" onClick={handleConfirmUpload}>
									开始上传（{pending.length}）
								</Button>
							</div>
						</div>
					)}

					{/* 上传进度 */}
					{tasks.length > 0 && (
						<div className="mt-3 max-h-48 space-y-2 overflow-auto">
							{tasks.map((t) => (
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
		</>
	)
}
