'use client'

/**
 * 首页背景剪纸：柱子 / 尖拱 / 花饰 / 提灯，按日种子（及问候 index）稀疏随机落在边缘，避开中央内容。
 */
import { FloralStamp, GothicArch, GreekColumn, Lantern } from '@/components/ui/ornaments'
import { shanghaiDateKey } from '@/data/daily-greetings'
import { type CSSProperties, useMemo } from 'react'

function mulberry32(seed: number): () => number {
	let a = seed >>> 0
	return () => {
		a |= 0
		a = (a + 0x6d2b79f5) | 0
		let t = Math.imul(a ^ (a >>> 15), 1 | a)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

function hashStr(s: string): number {
	let h = 2166136261
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i)
		h = Math.imul(h, 16777619)
	}
	return h >>> 0
}

type Slot = {
	key: string
	kind: 'column' | 'columnFlip' | 'arch' | 'floral' | 'lantern'
	/** 百分比定位，贴边；避开中部约 18%–82% 宽与 22%–78% 高 */
	style: CSSProperties
	className: string
}

const KINDS: Slot['kind'][] = ['column', 'columnFlip', 'arch', 'floral', 'lantern']

/** 边缘落点：四角 / 左右腰，不挡问候卡与搜索区 */
function edgeSpot(rand: () => number): {
	left?: string
	right?: string
	top?: string
	bottom?: string
} {
	const zone = Math.floor(rand() * 6)
	switch (zone) {
		case 0: // 左上
			return { left: `${2 + rand() * 10}%`, top: `${8 + rand() * 18}%` }
		case 1: // 右上
			return { right: `${2 + rand() * 12}%`, top: `${6 + rand() * 20}%` }
		case 2: // 左下
			return { left: `${1 + rand() * 12}%`, bottom: `${2 + rand() * 18}%` }
		case 3: // 右下
			return { right: `${0 + rand() * 10}%`, bottom: `${0 + rand() * 16}%` }
		case 4: // 左腰
			return { left: `${0 + rand() * 8}%`, top: `${38 + rand() * 24}%` }
		default: // 右腰
			return { right: `${0 + rand() * 8}%`, top: `${36 + rand() * 26}%` }
	}
}

function layout(seed: number): Slot[] {
	const rand = mulberry32(seed ^ 0x9e3779b9)
	const count = 3 + Math.floor(rand() * 2) // 3–4 件，稀疏
	const pool = [...KINDS]
	for (let i = pool.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1))
		;[pool[i], pool[j]] = [pool[j], pool[i]]
	}
	const chosen = pool.slice(0, count)
	const usedZones = new Set<string>()

	return chosen.map((kind, i) => {
		let spot = edgeSpot(rand)
		let guard = 0
		let zoneKey = JSON.stringify(spot)
		while (usedZones.has(zoneKey) && guard++ < 8) {
			spot = edgeSpot(rand)
			zoneKey = JSON.stringify(Object.keys(spot).sort().join())
		}
		usedZones.add(Object.keys(spot).sort().join() + String(Math.floor(i / 2)))

		const rot = (rand() - 0.5) * 14
		const opacity = 0.1 + rand() * 0.07
		const base: CSSProperties = {
			...spot,
			opacity,
			transform: `rotate(${rot.toFixed(1)}deg)`,
		}

		switch (kind) {
			case 'column':
				return {
					key: `col-${i}`,
					kind,
					style: { ...base, height: `${36 + rand() * 22}vh`, width: 'auto' },
					className: 'absolute hidden w-auto xl:block',
				}
			case 'columnFlip':
				return {
					key: `colf-${i}`,
					kind,
					style: {
						...base,
						height: `${28 + rand() * 18}vh`,
						width: 'auto',
						transform: `scaleX(-1) rotate(${rot.toFixed(1)}deg)`,
					},
					className: 'absolute hidden w-auto 2xl:block',
				}
			case 'arch':
				return {
					key: `arch-${i}`,
					kind,
					style: { ...base, height: `${7 + rand() * 5}rem`, width: 'auto' },
					className: 'absolute hidden w-auto lg:block',
				}
			case 'floral':
				return {
					key: `floral-${i}`,
					kind,
					style: {
						...base,
						height: `${5 + rand() * 4}rem`,
						width: `${5 + rand() * 4}rem`,
					},
					className: 'absolute hidden lg:block',
				}
			default:
				return {
					key: `lantern-${i}`,
					kind,
					style: { ...base, height: `${5 + rand() * 3}rem`, width: 'auto' },
					className: 'absolute hidden w-auto xl:block',
				}
		}
	})
}

function renderSlot(s: Slot) {
	switch (s.kind) {
		case 'column':
		case 'columnFlip':
			return <GreekColumn key={s.key} className={s.className} style={s.style} />
		case 'arch':
			return <GothicArch key={s.key} className={s.className} style={s.style} />
		case 'floral':
			return <FloralStamp key={s.key} className={s.className} style={s.style} />
		default:
			return <Lantern key={s.key} className={s.className} style={s.style} />
	}
}

export function PortalScrapDecor({
	/** 问候池下标：换一句时重掷落位 */
	greetingIndex = 0,
}: {
	greetingIndex?: number
}) {
	const slots = useMemo(() => {
		const day = shanghaiDateKey()
		const seed = hashStr(`${day}:scrap:${greetingIndex}`)
		return layout(seed || 1)
	}, [greetingIndex])

	return (
		<div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
			{slots.map(renderSlot)}
		</div>
	)
}
