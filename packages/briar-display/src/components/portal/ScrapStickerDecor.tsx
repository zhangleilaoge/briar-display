'use client'

/**
 * 门户 / 想法页共用黑白古典贴纸：
 * 每屏最多 3 枚，仅黑白（可白描边），空白区互不重叠。
 * seedKey 变化（如问候掀页换一句）时：淡出 → 换一批 → 淡入。
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
import { type CSSProperties, useEffect, useMemo, useState } from 'react'

type Placed = {
	key: string
	sticker: ScrapSticker
	style: CSSProperties
	imgStyle: CSSProperties
}

const FADE_MS = 320

function layout(page: ScrapPage, seed: number, count: number): Placed[] {
	const rand = mulberry32(seed ^ 0xa11ce)
	const zones = [...zonesFor(page)]
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
	const usedIds = new Set<string>()
	const usedFamilies = new Set<string>()
	const n = Math.min(3, count, pool.length, zones.length)

	for (let i = 0; i < pool.length && placed.length < n; i++) {
		const sticker = pool[i]
		if (usedIds.has(sticker.id) || usedFamilies.has(sticker.family)) continue
		const zone = zones[placed.length % zones.length]
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
		usedIds.add(sticker.id)
		usedFamilies.add(sticker.family)
		const rot = (rand() - 0.5) * 14
		const opacity = 0.12 + rand() * 0.1
		placed.push({
			key: `${sticker.id}-${i}-${seed}`,
			sticker,
			style: {
				left: `${box.x.toFixed(2)}%`,
				top: `${box.y.toFixed(2)}%`,
				width: `${box.w.toFixed(2)}%`,
				opacity,
				transform: `rotate(${rot.toFixed(1)}deg)`,
			},
			imgStyle: {
				width: '100%',
				height: 'auto',
				maxHeight: sticker.kind === 'tall' ? '11rem' : sticker.kind === 'wide' ? '5.5rem' : '7rem',
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
	seedKey?: number | string
	count?: number
	className?: string
}) {
	const targetSeed = useMemo(() => {
		const day = shanghaiDateKey()
		return hashStr(`${day}:scrap-${page}:${seedKey}`) || 1
	}, [page, seedKey])

	const [activeSeed, setActiveSeed] = useState(targetSeed)
	const [fading, setFading] = useState(false)

	useEffect(() => {
		if (targetSeed === activeSeed) return
		// 等问候掀页（角部卷曲 ~1.2s）结束再淡出换一批，再淡入
		let fadeTimer: number | null = null
		const wait = window.setTimeout(() => {
			setFading(true)
			fadeTimer = window.setTimeout(() => {
				setActiveSeed(targetSeed)
				requestAnimationFrame(() => {
					requestAnimationFrame(() => setFading(false))
				})
			}, FADE_MS)
		}, 1100)
		return () => {
			window.clearTimeout(wait)
			if (fadeTimer != null) window.clearTimeout(fadeTimer)
		}
	}, [targetSeed, activeSeed])

	const slots = useMemo(() => {
		const raw = count ?? 2 + (activeSeed % 2)
		const n = Math.min(3, Math.max(1, raw))
		return layout(page, activeSeed, n)
	}, [page, activeSeed, count])

	return (
		<div
			aria-hidden
			className={cn(
				'pointer-events-none fixed inset-0 -z-10 overflow-hidden',
				'hidden lg:block',
				'rv-scrap-decor',
				fading && 'is-fading',
				className,
			)}
		>
			{slots.map((s) => (
				<div key={s.key} className="absolute" style={s.style}>
					<img
						src={s.sticker.src}
						alt=""
						draggable={false}
						decoding="async"
						loading="lazy"
						className="rv-cutout pointer-events-none select-none object-contain"
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
