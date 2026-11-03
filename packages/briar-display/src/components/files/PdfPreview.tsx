import type { FileItem } from '@/api/files'
import { useEffect, useState } from 'react'

/**
 * PDF 预览：COS 默认域名（2024 年后新建的桶）对任何对象都强制返回
 * `Content-Disposition: attachment` + `x-cos-force-download: true`，
 * 直接把签名 URL 塞进 iframe 会被浏览器当下载处理（预览区空白 + 弹下载）。
 * 这里先 fetch 成 Blob，再用 blob: URL 渲染，绕开响应头；失败时给出明确提示。
 */
export default function PdfPreview({
	file,
	onDownload,
}: { file: FileItem; onDownload: () => void }) {
	const [blobUrl, setBlobUrl] = useState<string | null>(null)
	const [error, setError] = useState(false)

	useEffect(() => {
		let cancelled = false
		let url: string | null = null
		setBlobUrl(null)
		setError(false)
		fetch(file.cdnUrl)
			.then((res) => {
				if (!res.ok) throw new Error(String(res.status))
				return res.arrayBuffer()
			})
			.then((buf) => {
				if (cancelled) return
				url = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }))
				setBlobUrl(url)
			})
			.catch(() => {
				if (!cancelled) setError(true)
			})
		return () => {
			cancelled = true
			if (url) URL.revokeObjectURL(url)
		}
	}, [file.cdnUrl])

	const boxClass =
		'flex h-[60vh] w-full flex-col items-center justify-center gap-3 border border-[color:var(--rv-navy)]/20 bg-[var(--rv-beige)] text-sm text-[color:var(--rv-navy)]/70'

	if (error) {
		return (
			<div className={boxClass}>
				<p>该文件暂时无法在线预览</p>
				<button
					type="button"
					onClick={onDownload}
					className="underline underline-offset-4 hover:opacity-80"
				>
					点此下载查看
				</button>
			</div>
		)
	}
	if (!blobUrl) {
		return <div className={boxClass}>加载中…</div>
	}
	return (
		<div className="flex flex-col gap-1">
			<iframe
				src={blobUrl}
				title={file.originalName}
				className="h-[60vh] w-full border border-[color:var(--rv-navy)]/20 bg-[var(--rv-beige)]"
			/>
			<a
				href={blobUrl}
				target="_blank"
				rel="noopener noreferrer"
				className="self-end text-xs text-[color:var(--rv-navy)]/60 underline underline-offset-4"
			>
				显示不出来？新标签页打开
			</a>
		</div>
	)
}
