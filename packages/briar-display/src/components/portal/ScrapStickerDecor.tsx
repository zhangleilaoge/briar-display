'use client'

/**
 * 门户 / 想法页共用黑白古典贴纸：
 * 从 SCRAP_STICKER_CATALOG 抽几枚，受限落空白区、互不重叠；CSS 白底圆角垫，SVG 素材须透明底。
 */
import { SCRAP_STICKER_CATALOG, type ScrapSticker } from '@/components/portal/scrapStickerCatalog'
import {
	type ScrapBox,
	type ScrapPage,
	hashStr,
	mulberry32,
	overlaps,
	sizeForKind,
	zonesFor,
} from '@/components/portal/scrapStickerLayout'
import { shanghaiDateKey } from '@/data/daily-greetings'
import { cn } from '@/lib/utils'
import { type CSSProperties, useMemo } from 'react'

type Placed = {
	key: string
	sticker: ScrapSticker
	style: CSSProperties
	imgStyle: CSSProperties
}

function layout(page: ScrapPage, seed: number, count: number): Placed[] {
	const rand = mulberry32(seed ^ 0xa11ce)
	const zones = [...zonesFor(page)]
	// shuffle zones
	for (let i = zones.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1))
		;[zones[i], zones[j]] = [zones[j], zones[i]]
	}
	const pool = [...SCRAP_STICKER_CATALOG]
	for (let i = pool.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1))
		;[pool[i], pool[j]] = [pool[j], pool[i]]
	}

	const placed: Placed[] = []
	const boxes: ScrapBox[] = []
	const n = Math.min(count, pool.length, zones.length)

	for (let i = 0; i < n; i++) {
		const sticker = pool[i]
		const zone = zones[i % zones.length]
		const sz = sizeForKind(sticker.kind, rand)
		let box: ScrapBox | null = null
		for (let attempt = 0; attempt < 14; attempt++) {
			const maxX = Math.max(0.2, zone.w - sz.w)
			const maxY = Math.max(0.2, zone.h - sz.h)
			const cand: ScrapBox = {
				x: zone.x + rand() * maxX,
				y: zone.y + rand() * maxY,
				w: sz.w,
				h: sz.h,
			}
			if (boxes.every((b) => !overlaps(cand, b))) {
				box = cand
				break
			}
		}
		if (!box) continue
		boxes.push(box)
		const rot = (rand() - 0.5) * 14
		placed.push({
			key: `${sticker.id}-${i}`,
			sticker,
			style: {
				left: `${box.x.toFixed(2)}%`,
				top: `${box.y.toFixed(2)}%`,
				width: `${box.w.toFixed(2)}%`,
				transform: `rotate(${rot.toFixed(1)}deg)`,
			},
			imgStyle: {
				width: '100%',
				height: 'auto',
				maxHeight: sticker.kind === 'tall' ? '11rem' : sticker.kind === 'wide' ? '5.5rem' : '7rem',
				filter: 'grayscale(1) contrast(1.05)',
			},
		})
	}
	return placed
}

export function ScrapStickerDecor({
	page,
	seedKey = 0,
	count,
	className,
}: {
	page: ScrapPage
	/** 换一句 / 日更等额外熵 */
	seedKey?: number | string
	count?: number
	className?: string
}) {
	const slots = useMemo(() => {
		const day = shanghaiDateKey()
		const seed = hashStr(`${day}:scrap-${page}:${seedKey}`)
		const n = count ?? (page === 'thoughts' ? 4 + (seed % 2) : 5 + (seed % 2))
		return layout(page, seed || 1, n)
	}, [page, seedKey, count])

	return (
		<div
			aria-hidden
			className={cn(
				'pointer-events-none fixed inset-0 -z-10 overflow-hidden',
				'hidden lg:block',
				className,
			)}
		>
			{slots.map((s) => (
				<div key={s.key} className="rv-sticker-pad absolute" style={s.style}>
					<img
						src={s.sticker.src}
						alt=""
						draggable={false}
						decoding="async"
						loading="lazy"
						className="pointer-events-none select-none object-contain"
						style={s.imgStyle}
					/>
				</div>
			))}
		</div>
	)
}

/** @deprecated 门户请用 ScrapStickerDecor page="portal" */
export function PortalScrapDecor({ greetingIndex = 0 }: { greetingIndex?: number }) {
	return <ScrapStickerDecor page="portal" seedKey={greetingIndex} />
}
