'use client'

import romanColumn from '@/assets/decor/stationery-stickers/02-00-roman-column.png'
import greekTemple from '@/assets/decor/stationery-stickers/02-01-greek-temple.png'
import venusStatue from '@/assets/decor/stationery-stickers/02-02-venus-statue.png'
import stoneArch from '@/assets/decor/stationery-stickers/02-03-stone-arch.png'
import churchWindow from '@/assets/decor/stationery-stickers/02-04-church-window.png'
import porcelainTeapot from '@/assets/decor/stationery-stickers/02-05-porcelain-teapot.png'
import porcelainVase from '@/assets/decor/stationery-stickers/02-06-porcelain-vase.png'
import pocketWatch from '@/assets/decor/stationery-stickers/02-07-blue-pocket-watch.png'
import teacup from '@/assets/decor/stationery-stickers/02-08-teacup.png'
import porcelainPlate from '@/assets/decor/stationery-stickers/02-09-porcelain-plate.png'
import arcDeTriomphe from '@/assets/decor/stationery-stickers/02-10-arc-de-triomphe.png'
import obelisk from '@/assets/decor/stationery-stickers/02-11-obelisk.png'
import fountain from '@/assets/decor/stationery-stickers/02-12-fountain.png'
import stoneBridge from '@/assets/decor/stationery-stickers/02-13-stone-bridge.png'
import classicalUrn from '@/assets/decor/stationery-stickers/02-14-classical-urn.png'
import gingerJar from '@/assets/decor/stationery-stickers/02-15-ginger-jar.png'
import candelabrum from '@/assets/decor/stationery-stickers/02-16-candelabrum.png'
import porcelainBowl from '@/assets/decor/stationery-stickers/02-17-porcelain-bowl.png'
import mantelClock from '@/assets/decor/stationery-stickers/02-18-mantel-clock.png'
import chandelier from '@/assets/decor/stationery-stickers/02-19-chandelier.png'
import { useEffect, useState } from 'react'

const STICKERS = [
	romanColumn,
	greekTemple,
	venusStatue,
	stoneArch,
	churchWindow,
	porcelainTeapot,
	porcelainVase,
	pocketWatch,
	teacup,
	porcelainPlate,
	arcDeTriomphe,
	obelisk,
	fountain,
	stoneBridge,
	classicalUrn,
	gingerJar,
	candelabrum,
	porcelainBowl,
	mantelClock,
	chandelier,
].map((image) => (typeof image === 'string' ? image : image.src))

/** 每次进入页面随机留一枚蓝白贴纸，低透明度融入背景。 */
export function ArcaneDecor() {
	const [decor, setDecor] = useState<{ src: string; rotation: number } | null>(null)

	useEffect(() => {
		setDecor({
			src: STICKERS[Math.floor(Math.random() * STICKERS.length)],
			rotation: Math.random() * 16 - 8,
		})
	}, [])

	return (
		<div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
			{decor && (
				<img
					src={decor.src}
					alt=""
					className="absolute -bottom-16 -right-12 h-[340px] w-[340px] select-none object-contain opacity-[0.14] blur-[0.35px] md:h-[420px] md:w-[420px]"
					style={{ transform: `rotate(${decor.rotation.toFixed(1)}deg)` }}
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
