'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Download, FileLock2, FileText, Loader2, Upload, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import ToolsLayout from './ToolsLayout'
import { PdfDecryptError, decryptPdf, formatSize, loadQpdf } from './toolPdfUnlockUtils'

interface PendingFile {
	id: string
	file: File
}

interface UnlockResult {
	id: string
	name: string
	originalSize: number
	outputSize: number
	outputUrl: string
}

export default function ToolPdfUnlockPage() {
	const [password, setPassword] = useState('')
	const [pending, setPending] = useState<PendingFile[]>([])
	const [results, setResults] = useState<UnlockResult[]>([])
	const [unlocking, setUnlocking] = useState(false)
	const [progress, setProgress] = useState('')
	const [dragging, setDragging] = useState(false)
	const fileInputRef = useRef<HTMLInputElement>(null)

	const stageFiles = useCallback((files: FileList | File[]) => {
		const pdfFiles = Array.from(files).filter(
			(f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
		)
		if (pdfFiles.length === 0) {
			if (files.length > 0) toast.error('仅支持 PDF 文件')
			return
		}
		setPending((prev) => [
			...prev,
			...pdfFiles.map((f) => ({ id: `${Date.now()}-${Math.random()}`, file: f })),
		])
	}, [])

	const removePending = useCallback((id: string) => {
		setPending((prev) => prev.filter((p) => p.id !== id))
	}, [])

	const clearPending = useCallback(() => setPending([]), [])

	const handleStart = useCallback(async () => {
		if (pending.length === 0) return
		setUnlocking(true)
		try {
			// 先确保 wasm 加载完成，再逐个处理
			await loadQpdf()
			const failed: PendingFile[] = []
			const newResults: UnlockResult[] = []
			let done = 0
			for (const item of pending) {
				setProgress(`正在处理 ${++done}/${pending.length}：${item.file.name}`)
				try {
					const data = new Uint8Array(await item.file.arrayBuffer())
					const out = await decryptPdf(data, password)
					const blob = new Blob([out], { type: 'application/pdf' })
					newResults.push({
						id: item.id,
						name: item.file.name,
						originalSize: item.file.size,
						outputSize: blob.size,
						outputUrl: URL.createObjectURL(blob),
					})
				} catch (err) {
					failed.push(item)
					const msg = err instanceof PdfDecryptError ? err.message : '处理失败'
					toast.error(`${item.file.name}：${msg}`)
				}
			}
			// 失败文件留在暂存区，填密码后可直接重试
			setPending(failed)
			setResults((prev) => [...newResults, ...prev])
			if (newResults.length > 0) toast.success(`已解除 ${newResults.length} 个文件的限制`)
		} finally {
			setUnlocking(false)
			setProgress('')
		}
	}, [pending, password])

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault()
			setDragging(false)
			stageFiles(e.dataTransfer.files)
		},
		[stageFiles],
	)

	const handleDownload = (result: UnlockResult) => {
		const a = document.createElement('a')
		a.href = result.outputUrl
		a.download = `${result.name.replace(/\.pdf$/i, '')}-无限制.pdf`
		a.click()
	}

	const handleRemove = (id: string) => {
		setResults((prev) => {
			const r = prev.find((p) => p.id === id)
			if (r) URL.revokeObjectURL(r.outputUrl)
			return prev.filter((p) => p.id !== id)
		})
	}

	return (
		<ToolsLayout currentPath="/briar/tools/pdf">
			<div className="space-y-6">
				{/* 设置面板 */}
				<Card className="glass">
					<CardHeader className="pb-4">
						<CardTitle className="flex items-center gap-2 text-lg">
							<FileLock2 className="h-5 w-5" />
							PDF 解除限制
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-1.5">
							<Label>打开密码</Label>
							<Input
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder="无打开密码可留空"
							/>
							<p className="text-xs text-muted-foreground">
								仅当
								PDF「打开就需要密码」时填写；只限制打印/复制的「权限密码」无需提供，直接处理即可
							</p>
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
					className={`glass-soft flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors sm:p-12 ${
						dragging ? 'border-primary' : 'border-white/80 hover:border-primary/50'
					}`}
				>
					<input
						ref={fileInputRef}
						type="file"
						accept="application/pdf,.pdf"
						multiple
						className="hidden"
						onChange={(e) => {
							if (e.target.files) stageFiles(e.target.files)
							e.target.value = ''
						}}
					/>
					<Upload className="h-10 w-10 text-muted-foreground" />
					<div className="text-center">
						<p className="text-sm font-medium">拖拽 PDF 到此处，或点击选择</p>
						<p className="mt-1 text-xs text-muted-foreground">
							支持批量；文件全程在浏览器本地处理，不会上传到服务器
						</p>
					</div>
				</div>

				{/* 待处理列表 */}
				{pending.length > 0 && (
					<div className="glass rounded-lg p-4">
						<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
							<h3 className="text-sm font-medium">
								待处理
								<span className="ml-2 text-muted-foreground">({pending.length})</span>
							</h3>
							<div className="flex items-center gap-2">
								<Button variant="outline" size="sm" onClick={clearPending} disabled={unlocking}>
									清空
								</Button>
								<Button size="sm" onClick={handleStart} disabled={unlocking} className="gap-1.5">
									{unlocking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
									{unlocking ? '处理中...' : '开始解除'}
								</Button>
							</div>
						</div>
						{progress && <p className="mb-2 truncate text-xs text-muted-foreground">{progress}</p>}
						<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
							{pending.map((p) => (
								<div
									key={p.id}
									className="group relative flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2"
								>
									<FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
									<div className="min-w-0 flex-1">
										<p className="truncate text-xs font-medium" title={p.file.name}>
											{p.file.name}
										</p>
										<p className="text-xs text-muted-foreground">{formatSize(p.file.size)}</p>
									</div>
									<button
										type="button"
										onClick={() => removePending(p.id)}
										className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border bg-white text-muted-foreground shadow transition-colors hover:text-destructive"
										title="移除"
									>
										<X className="h-3 w-3" />
									</button>
								</div>
							))}
						</div>
					</div>
				)}

				{/* 结果列表 */}
				{results.length > 0 && (
					<div className="space-y-3">
						<h3 className="text-sm font-medium">
							处理结果
							<span className="ml-2 text-muted-foreground">({results.length})</span>
						</h3>

						{results.map((r) => (
							<Card key={r.id}>
								<CardContent className="flex flex-wrap items-center gap-4 py-4">
									<FileText className="h-10 w-10 shrink-0 text-muted-foreground" />

									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium">{r.name}</p>
										<p className="text-xs text-muted-foreground">
											{formatSize(r.originalSize)} → {formatSize(r.outputSize)}
										</p>
									</div>

									<Badge variant="outline" className="bg-green-50 text-green-700">
										已解除限制
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
						))}
					</div>
				)}
			</div>
		</ToolsLayout>
	)
}
