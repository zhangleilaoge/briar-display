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
import { Loader2, Upload } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

interface UploadTask {
	name: string
	percent: number
	done: boolean
	error?: string
}

interface UploadDialogProps {
	/** 上传到哪个文件夹（null = 根目录） */
	folderId: string | null
	/** 上传完成后回调（用于刷新列表） */
	onUploaded: () => void
}

/** 上传按钮 + 对话框（拖拽/点击/粘贴，分片直传 COS，逐文件进度） */
export default function UploadDialog({ folderId, onUploaded }: UploadDialogProps) {
	const [open, setOpen] = useState(false)
	const [uploading, setUploading] = useState(false)
	const [tasks, setTasks] = useState<UploadTask[]>([])
	const [dragging, setDragging] = useState(false)
	const fileInputRef = useRef<HTMLInputElement>(null)

	const handleUploadFiles = useCallback(
		async (fileList: FileList | File[]) => {
			const valid = Array.from(fileList)
			if (valid.length === 0) return

			setUploading(true)
			setTasks(valid.map((f) => ({ name: f.name, percent: 0, done: false })))
			try {
				const results = await uploadFiles(valid, {
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
				if (failed === 0) {
					setOpen(false)
					setTasks([])
				}
			} catch (err: any) {
				toast.error(err?.message || '上传失败')
			} finally {
				setUploading(false)
			}
		},
		[folderId, onUploaded],
	)

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault()
			setDragging(false)
			handleUploadFiles(e.dataTransfer.files)
		},
		[handleUploadFiles],
	)

	// 剪贴板粘贴上传：div 的 onPaste 依赖焦点（div 不可聚焦时收不到），
	// 改为弹窗打开期间挂 document 级监听
	useEffect(() => {
		if (!open) return
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
				handleUploadFiles(pasted)
			}
		}
		document.addEventListener('paste', onPaste)
		return () => document.removeEventListener('paste', onPaste)
	}, [open, handleUploadFiles])

	return (
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
							: 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
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
						<p className="mt-1 text-xs text-muted-foreground">支持任意类型文件，单文件最大 200MB</p>
					</div>
				</div>
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
	)
}
