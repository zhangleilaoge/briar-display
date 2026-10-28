'use client'

import type { GreetingKind } from '@/data/daily-greetings'
import { layoutGreetingStickers } from '@/data/greeting-decor'
import { useMemo } from 'react'

/**
 * 明信片外圈分类贴纸：裸 emoji、无白底圆章，位置由 seed 派生。
 * 须挂在「可溢出」的相对容器上（堆叠外框），不要塞进 overflow-hidden 的白卡内。
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
		<div className="pointer-events-none absolute inset-0 z-[3] overflow-visible" aria-hidden>
			{stickers.map((s, i) => (
				<span
					key={`${seed}-${i}-${s.emoji}`}
					className="rv-greet-sticker absolute inline-flex select-none items-center justify-center leading-none"
					style={{
						left: `${s.left}%`,
						top: `${s.top}%`,
						transform: `translate(-50%, -50%) rotate(${s.rotate}deg)`,
						opacity: s.opacity,
						fontSize: `${s.size}rem`,
					}}
				>
					{s.emoji}
				</span>
			))}
		</div>
	)
}
