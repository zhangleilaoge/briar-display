'use client'

import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useCallback, useEffect } from 'react'
import type { MediaItem } from './toolMediaUtils'

interface ToolMediaLightboxProps {
	images: MediaItem[]
	/** 当前预览下标，null 表示关闭 */
	index: number | null
	onClose: () => void
	onNavigate: (index: number) => void
}

/** 图集全屏预览：Esc 关闭，←/→ 或两侧按钮切换 */
export default function ToolMediaLightbox({
	images,
	index,
	onClose,
	onNavigate,
}: ToolMediaLightboxProps) {
	const hasPrev = index !== null && index > 0
	const hasNext = index !== null && index < images.length - 1

	const goPrev = useCallback(() => {
		if (hasPrev) onNavigate(index - 1)
	}, [hasPrev, index, onNavigate])
	const goNext = useCallback(() => {
		if (hasNext) onNavigate(index + 1)
	}, [hasNext, index, onNavigate])

	useEffect(() => {
		if (index === null) return
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose()
			if (e.key === 'ArrowLeft') goPrev()
			if (e.key === 'ArrowRight') goNext()
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [index, onClose, goPrev, goNext])

	if (index === null) return null
	const current = images[index]

	return (
		<div
			className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90"
			onClick={onClose}
		>
			<button
				type="button"
				aria-label="关闭预览"
				className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
				onClick={onClose}
			>
				<X className="h-5 w-5" />
			</button>
			{hasPrev && (
				<button
					type="button"
					aria-label="上一张"
					className="absolute left-4 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
					onClick={(e) => {
						e.stopPropagation()
						goPrev()
					}}
				>
					<ChevronLeft className="h-6 w-6" />
				</button>
			)}
			{hasNext && (
				<button
					type="button"
					aria-label="下一张"
					className="absolute right-4 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
					onClick={(e) => {
						e.stopPropagation()
						goNext()
					}}
				>
					<ChevronRight className="h-6 w-6" />
				</button>
			)}
			<img
				src={current.url}
				alt={current.label}
				referrerPolicy="no-referrer"
				className="max-h-full max-w-full object-contain"
				onClick={(e) => e.stopPropagation()}
			/>
			<div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm text-white">
				{current.label} · {index + 1}/{images.length}
			</div>
		</div>
	)
}
