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

/** 上传按钮 + 对话框（页面级粘贴/拖拽自动唤起；拖拽/点击/粘贴先暂存，点「开始上传」后分片直传 COS，逐文件进度） */
export default function UploadDialog({ folderId, onUploaded }: UploadDialogProps) {
	const [open, setOpen] = useState(false)
	const [uploading, setUploading] = useState(false)
	const [pending, setPending] = useState<PendingItem[]>([])
	const [tasks, setTasks] = useState<UploadTask[]>([])
	const [dragging, setDragging] = useState(false)
	const [pageDragging, setPageDragging] = useState(false)
	const fileInputRef = useRef<HTMLInputElement>(null)

	// 拖拽/选择/粘贴只进暂存列表，不上传；同名同大小去重
	const stageFiles = useCallback((fileList: FileList | File[]) => {
		const files = Array.from(fileList)
		if (files.length === 0) return
		setPending((prev) => {
			const seen = new Set(prev.map((p) => `${p.file.name}:${p.file.size}`))
			const added = files
				.filter((f) => !seen.has(`${f.name}:${f.size}`))
				.map((f) => ({ id: `${Date.now()}-${Math.random()}`, file: f }))
			return [...prev, ...added]
		})
	}, [])

	const removePending = useCallback((id: string) => {
		setPending((prev) => prev.filter((p) => p.id !== id))
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
			// 失败的保留在暂存列表可重试，成功的移除
			const failedNames = new Set(results.filter((r) => r.error).map((r) => r.name))
			setPending((prev) => prev.filter((p) => failedNames.has(p.file.name)))
			if (failed === 0) {
				setOpen(false)
				setTasks([])
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
		const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
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
			<Dialog
				open={open}
				onOpenChange={(next) => {
					if (!uploading) {
						setOpen(next)
						if (!next) setTasks([])
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

					{/* 暂存列表：确认前可增删 */}
					{pending.length > 0 && !uploading && (
						<div className="mt-3 space-y-3">
							<div className="max-h-48 space-y-1.5 overflow-auto">
								{pending.map((p) => (
									<div
										key={p.id}
										className="flex items-center gap-2 rounded-md border bg-card px-3 py-2"
									>
										<FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
										<span className="min-w-0 flex-1 truncate text-xs">{p.file.name}</span>
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
								<Button variant="outline" size="sm" onClick={() => setPending([])}>
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
