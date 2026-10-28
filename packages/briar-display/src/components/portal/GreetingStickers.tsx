'use client'

import type { GreetingKind } from '@/data/daily-greetings'
import { layoutGreetingStickers } from '@/data/greeting-decor'
import { useMemo } from 'react'

/**
 * 明信片内分类贴纸：扁平软印章风，位置由 seed 派生。
 * aria-hidden — 纯装饰，不抢焦点。
 */
export function GreetingStickers({
	kind,
	seed,
}: {
	kind: GreetingKind | ''
	/** 问候下标 + 换一句次数等，变化即重掷位置 */
	seed: number
}) {
	const stickers = useMemo(() => {
		if (!kind) return []
		return layoutGreetingStickers(kind, seed || 1)
	}, [kind, seed])

	if (!stickers.length) return null

	return (
		<div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
			{stickers.map((s, i) => (
				<span
					key={`${seed}-${i}-${s.emoji}`}
					className="rv-greet-sticker absolute inline-flex items-center justify-center rounded-full"
					style={{
						left: `${s.left}%`,
						top: `${s.top}%`,
						width: `${s.size}rem`,
						height: `${s.size}rem`,
						transform: `translate(-50%, -50%) rotate(${s.rotate}deg)`,
						opacity: s.opacity,
						background: s.wash,
						fontSize: `${s.size * 0.55}rem`,
						lineHeight: 1,
					}}
				>
					<span className="rv-greet-sticker-glyph select-none">{s.emoji}</span>
				</span>
			))}
		</div>
	)
}
