'use client'

import { ARCANE_STICKERS } from '@/data/decor-assets'
import { useEffect, useState } from 'react'

/** 每次进入页面随机留一枚蓝白贴纸，低透明度融入背景。 */
export function ArcaneDecor() {
	const [decor, setDecor] = useState<string | null>(null)

	useEffect(() => {
		setDecor(ARCANE_STICKERS[Math.floor(Math.random() * ARCANE_STICKERS.length)])
	}, [])

	return (
		<div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
			{decor && (
				<img
					src={decor}
					alt=""
					className="absolute bottom-10 right-2 h-auto w-auto select-none opacity-[0.14] md:right-6"
					draggable={false}
				/>
			)}
			<div className="absolute left-3 right-3 top-3 hidden h-px bg-[var(--rv-line)] opacity-40 md:block" />
			<div className="absolute bottom-4 left-3 right-3 hidden h-px bg-[var(--rv-line)] opacity-25 md:block" />
			<div className="absolute bottom-5 right-6 hidden items-center gap-2 font-label text-[9px] uppercase tracking-[0.22em] text-[color:var(--rv-navy)]/55 xl:flex">
				<span className="rv-barcode" />
				<span>XIAOBUZI · ARCHIVE</span>
			</div>
		</div>
	)
}
