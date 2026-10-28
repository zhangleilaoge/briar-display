'use client'

import { type FileItem, getFileContent } from '@/api/files'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Check, Clipboard, Download, X } from 'lucide-react'
import { Suspense, lazy, useEffect, useState } from 'react'
import DocxPreview from './DocxPreview'
import ExcelPreview from './ExcelPreview'
import FileTypeIcon from './FileTypeIcon'

// BlockNote 体积大（~1MB），仅预览 md 时才加载
const MarkdownPreview = lazy(() => import('./MarkdownPreview'))

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function isMarkdown(name: string): boolean {
	const lower = name.toLowerCase()
	return lower.endsWith('.md') || lower.endsWith('.markdown')
}

type PreviewKind =
	| 'image'
	| 'video'
	| 'audio'
	| 'markdown'
	| 'text'
	| 'pdf'
	| 'excel'
	| 'docx'
	| 'none'

const EXCEL_EXTENSIONS = ['.xls', '.xlsx', '.csv']

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

// 与后端 fileDal.isTextLike 的 TEXT_EXTS 保持一致：mimeType 非 text/* 时按扩展名兜底当文本预览
const TEXT_EXTENSIONS = [
	'.txt',
	'.log',
	'.json',
	'.js',
	'.jsx',
	'.ts',
	'.tsx',
	'.css',
	'.html',
	'.vue',
	'.py',
	'.java',
	'.c',
	'.cpp',
	'.h',
	'.go',
	'.rs',
	'.sh',
	'.php',
	'.rb',
	'.swift',
	'.kt',
	'.sql',
	'.xml',
	'.yaml',
	'.yml',
	'.toml',
	'.ini',
]

function getPreviewKind(file: FileItem): PreviewKind {
	if (file.mimeType.startsWith('image/')) return 'image'
	if (file.mimeType.startsWith('video/')) return 'video'
	if (file.mimeType.startsWith('audio/')) return 'audio'
	if (isMarkdown(file.originalName)) return 'markdown'
	const lower = file.originalName.toLowerCase()
	// csv 也走表格预览（SheetJS 可读 csv），注意要在 text/* 判断之前（text/csv 命中 text/）
	if (EXCEL_EXTENSIONS.some((ext) => lower.endsWith(ext))) return 'excel'
	if (file.mimeType === 'application/pdf' || lower.endsWith('.pdf')) return 'pdf'
	if (file.mimeType === DOCX_MIME || lower.endsWith('.docx')) return 'docx'
	if (file.mimeType.startsWith('text/') || file.mimeType === 'application/json') return 'text'
	if (TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext))) return 'text'
	return 'none'
}

function previewLabel(kind: PreviewKind): { fr: string; zh: string; index: string } {
	switch (kind) {
		case 'video':
			return { fr: 'VIDÉO', zh: '视频预览', index: '01' }
		case 'image':
			return { fr: 'IMAGE', zh: '图片预览', index: '01' }
		case 'audio':
			return { fr: 'AUDIO', zh: '音频预览', index: '01' }
		case 'pdf':
			return { fr: 'DOCUMENT', zh: '文档预览', index: '02' }
		case 'markdown':
		case 'text':
			return { fr: 'TEXTE', zh: '文本预览', index: '02' }
		case 'excel':
			return { fr: 'TABLEAU', zh: '表格预览', index: '02' }
		case 'docx':
			return { fr: 'DOCUMENT', zh: '文稿预览', index: '02' }
		default:
			return { fr: 'APERÇU', zh: '文件详情', index: '01' }
	}
}

interface Props {
	file: FileItem
	onClose: () => void
	onDelete: (id: string) => void
}

export default function FileDetailModal({ file, onClose, onDelete }: Props) {
	const [copied, setCopied] = useState(false)
	const [previewOpen, setPreviewOpen] = useState(false)
	const [textContent, setTextContent] = useState<string | null>(null)
	const [textError, setTextError] = useState<string | null>(null)

	const kind = getPreviewKind(file)

	useEffect(() => {
		if (kind !== 'markdown' && kind !== 'text') return
		let cancelled = false
		getFileContent(file.id)
			.then((content) => {
				if (!cancelled) setTextContent(String(content))
			})
			.catch((err: any) => {
				if (!cancelled) setTextError(err?.response?.data?.message || '加载内容失败')
			})
		return () => {
			cancelled = true
		}
	}, [file.id, kind])

	const copyLink = async () => {
		await navigator.clipboard.writeText(file.cdnUrl)
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}

	const download = async () => {
		try {
			const res = await fetch(file.cdnUrl)
			const blob = await res.blob()
			const url = URL.createObjectURL(blob)
			const a = document.createElement('a')
			a.href = url
			a.download = file.originalName
			document.body.appendChild(a)
			a.click()
			document.body.removeChild(a)
			URL.revokeObjectURL(url)
		} catch {
			window.open(file.cdnUrl, '_blank')
		}
	}

	const label = previewLabel(kind)

	return (
		<div
			className="rv-paper-overlay fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4"
			onClick={onClose}
		>
			{/* 全屏图片预览（仅图片类型可用，点击任意处关闭） */}
			{previewOpen && (
				<div
					className="fixed inset-0 z-[110] flex cursor-zoom-out items-center justify-center bg-black/90 p-4"
					onClick={(e) => {
						e.stopPropagation()
						setPreviewOpen(false)
					}}
				>
					<img
						src={file.cdnUrl}
						alt={file.originalName}
						className="max-h-full max-w-full object-contain"
					/>
				</div>
			)}

			<div
				className="rv-paper-dialog relative max-h-[90vh] w-full max-w-3xl overflow-visible"
				onClick={(e) => e.stopPropagation()}
			>
				<span className="rv-crop-marks" aria-hidden>
					<span />
				</span>
				<span className="rv-paper-index">{label.index}</span>

				{/* 藏青顶栏 */}
				<div className="rv-paper-header sticky top-0 z-10 !mx-0 !mt-0 mb-0 rounded-none">
					<h2 className="rv-paper-title max-w-[85%] truncate px-2">
						{label.fr} · {label.zh}
					</h2>
					<p className="max-w-[90%] truncate font-display text-xs text-white/70">
						{file.originalName}
					</p>
					<button
						type="button"
						data-rv-dialog-close=""
						aria-label="关闭"
						className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-sm p-1 text-white/85 transition-opacity hover:bg-white/10 hover:text-white"
						onClick={onClose}
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<div className="max-h-[calc(90vh-4.5rem)] overflow-auto p-5 sm:p-6">
					{/* Preview */}
					<div className="mb-5">
						{kind === 'image' && (
							<div className="flex justify-center border border-[color:var(--rv-navy)]/20 bg-[var(--rv-beige)] p-3">
								<img
									src={file.cdnUrl}
									alt={file.originalName}
									title="点击全屏预览"
									className="max-h-[50vh] max-w-full cursor-zoom-in object-contain"
									onClick={() => setPreviewOpen(true)}
								/>
							</div>
						)}
						{kind === 'video' && (
							<div className="flex justify-center border border-[color:var(--rv-navy)]/25 bg-[var(--rv-navy)] p-2">
								{/* biome-ignore lint/a11y/useMediaCaption: 用户上传的视频没有字幕文件 */}
								<video src={file.cdnUrl} controls autoPlay className="max-h-[50vh] max-w-full" />
							</div>
						)}
						{(kind === 'markdown' || kind === 'text') && (
							<>
								{textError && (
									<div className="border border-[color:var(--rv-navy)]/15 bg-[var(--rv-beige)] p-4 text-center text-sm text-muted-foreground">
										{textError}
									</div>
								)}
								{!textError && textContent === null && (
									<div className="border border-[color:var(--rv-navy)]/15 bg-[var(--rv-beige)] p-4 text-center text-sm text-muted-foreground">
										加载中...
									</div>
								)}
								{!textError && textContent !== null && kind === 'markdown' && (
									<Suspense
										fallback={
											<div className="border border-[color:var(--rv-navy)]/15 bg-[var(--rv-beige)] p-4 text-center text-sm text-muted-foreground">
												加载中...
											</div>
										}
									>
										<MarkdownPreview markdown={textContent} />
									</Suspense>
								)}
								{!textError && textContent !== null && kind === 'text' && (
									<pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap break-all border border-[color:var(--rv-navy)]/15 bg-white p-4 font-mono text-xs">
										{textContent}
									</pre>
								)}
							</>
						)}
						{kind === 'pdf' && (
							<iframe
								src={file.cdnUrl}
								title={file.originalName}
								className="h-[60vh] w-full border border-[color:var(--rv-navy)]/20 bg-[var(--rv-beige)]"
							/>
						)}
						{kind === 'excel' && <ExcelPreview file={file} />}
						{kind === 'docx' && <DocxPreview file={file} />}
						{kind === 'audio' && (
							<div className="flex justify-center border border-[color:var(--rv-navy)]/15 bg-[var(--rv-beige)] p-6">
								{/* biome-ignore lint/a11y/useMediaCaption: 用户上传的音频没有字幕文件 */}
								<audio src={file.cdnUrl} controls className="w-full max-w-md" />
							</div>
						)}
						{kind === 'none' && (
							<div className="flex flex-col items-center gap-2 border border-[color:var(--rv-navy)]/15 bg-[var(--rv-beige)] py-10 text-muted-foreground">
								<FileTypeIcon fileName={file.originalName} mimeType={file.mimeType} />
								<p className="text-sm">该类型不支持预览</p>
							</div>
						)}
					</div>

					{/* Metadata — 纸片分行 */}
					<div className="mb-5 grid grid-cols-2 gap-0 border border-[color:var(--rv-navy)]/20 sm:grid-cols-4">
						<div className="rv-paper-row min-w-0 !border-b-0 border-r border-[color:var(--rv-navy)]/15">
							<div>
								<p className="rv-label text-[10px] text-muted-foreground">TAILLE · 大小</p>
								<p className="font-display text-base font-semibold">{formatSize(file.size)}</p>
							</div>
						</div>
						<div className="rv-paper-row min-w-0 !border-b-0 border-r border-[color:var(--rv-navy)]/15 sm:border-r">
							<div className="min-w-0">
								<p className="rv-label text-[10px] text-muted-foreground">TYPE · 类型</p>
								<p className="truncate font-display text-sm font-semibold" title={file.mimeType}>
									{file.mimeType}
								</p>
							</div>
						</div>
						{file.width && file.height ? (
							<div className="rv-paper-row min-w-0 !border-b-0 border-r border-[color:var(--rv-navy)]/15">
								<div>
									<p className="rv-label text-[10px] text-muted-foreground">DIMENSION · 尺寸</p>
									<p className="font-display text-base font-semibold">
										{file.width} × {file.height}
									</p>
								</div>
							</div>
						) : (
							<div className="rv-paper-row min-w-0 !border-b-0 border-r border-[color:var(--rv-navy)]/15">
								<div>
									<p className="rv-label text-[10px] text-muted-foreground">DATE · 上传</p>
									<p className="font-display text-base font-semibold">
										{new Date(file.createdAt).toLocaleDateString('zh-CN')}
									</p>
								</div>
							</div>
						)}
						<div className="rv-paper-row min-w-0 !border-b-0">
							<div>
								<p className="rv-label text-[10px] text-muted-foreground">FICHIER · 文件</p>
								<p
									className="truncate font-display text-sm font-semibold"
									title={file.originalName}
								>
									{file.originalName}
								</p>
							</div>
						</div>
					</div>

					{/* Actions */}
					<div className="flex flex-wrap items-center gap-2 border-t border-[color:var(--rv-navy)]/15 pt-4">
						<Button variant="outline" size="sm" className="gap-1.5" onClick={copyLink}>
							{copied ? (
								<Check className="h-4 w-4 text-success" />
							) : (
								<Clipboard className="h-4 w-4" />
							)}
							复制链接
						</Button>
						<Button variant="outline" size="sm" className="gap-1.5" onClick={download}>
							<Download className="h-4 w-4" /> 下载
						</Button>
						<Button
							variant="destructive"
							size="sm"
							className={cn('ml-auto gap-1.5')}
							onClick={() => onDelete(file.id)}
						>
							<X className="h-4 w-4" /> 删除
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}
