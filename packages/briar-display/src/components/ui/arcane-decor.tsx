'use client'

import { assetUrl } from '@/lib/assets'
import { useEffect, useState } from 'react'

const STICKERS = [
	'02-00-roman-column',
	'02-01-greek-temple',
	'02-02-venus-statue',
	'02-03-stone-arch',
	'02-04-church-window',
	'02-05-porcelain-teapot',
	'02-06-porcelain-vase',
	'02-07-blue-pocket-watch',
	'02-08-teacup',
	'02-09-porcelain-plate',
	'02-10-arc-de-triomphe',
	'02-11-obelisk',
	'02-12-fountain',
	'02-13-stone-bridge',
	'02-14-classical-urn',
	'02-15-ginger-jar',
	'02-16-candelabrum',
	'02-17-porcelain-bowl',
	'02-18-mantel-clock',
	'02-19-chandelier',
].map((name) => assetUrl(`decor/stationery-stickers/${name}.png`))

/** 每次进入页面随机留一枚蓝白贴纸，低透明度融入背景。 */
export function ArcaneDecor() {
	const [decor, setDecor] = useState<string | null>(null)

	useEffect(() => {
		setDecor(STICKERS[Math.floor(Math.random() * STICKERS.length)])
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
