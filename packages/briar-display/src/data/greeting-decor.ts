/**
 * 问候明信片分类贴纸：同一 kind 共用视觉家族（扁平剪纸 / 软印章）。
 * 位置由 seed 派生，换一句时换 seed 重掷，并保证间距。
 */

import type { GreetingKind } from './daily-greetings'

export interface DecorGlyph {
	/** 精选 emoji（配合 CSS 做成软印章，非 Fluent 立体贴纸） */
	emoji: string
	/** 略偏色的印章底，贴近剪纸色板 */
	wash: string
}

/** 每类 5–6 个候选；渲染时抽 2–3 个 */
export const KIND_GLYPHS: Record<GreetingKind, readonly DecorGlyph[]> = {
	proverb: [
		{ emoji: '📜', wash: 'hsl(32 28% 88%)' },
		{ emoji: '🖋️', wash: 'hsl(215 22% 88%)' },
		{ emoji: '🍵', wash: 'hsl(95 18% 88%)' },
		{ emoji: '🎋', wash: 'hsl(140 16% 88%)' },
		{ emoji: '📖', wash: 'hsl(28 24% 90%)' },
		{ emoji: '🏛️', wash: 'hsl(220 14% 90%)' },
	],
	joke: [
		{ emoji: '😄', wash: 'hsl(42 45% 90%)' },
		{ emoji: '🎭', wash: 'hsl(330 28% 90%)' },
		{ emoji: '✨', wash: 'hsl(48 40% 91%)' },
		{ emoji: '🐱', wash: 'hsl(25 30% 90%)' },
		{ emoji: '🃏', wash: 'hsl(265 22% 90%)' },
		{ emoji: '🎈', wash: 'hsl(350 35% 91%)' },
	],
	encourage: [
		{ emoji: '🌟', wash: 'hsl(45 50% 90%)' },
		{ emoji: '🌱', wash: 'hsl(125 28% 90%)' },
		{ emoji: '🚀', wash: 'hsl(210 35% 90%)' },
		{ emoji: '💪', wash: 'hsl(12 35% 90%)' },
		{ emoji: '🌻', wash: 'hsl(48 42% 90%)' },
		{ emoji: '🔥', wash: 'hsl(18 45% 90%)' },
	],
	witty: [
		{ emoji: '💡', wash: 'hsl(48 48% 90%)' },
		{ emoji: '🧩', wash: 'hsl(280 22% 90%)' },
		{ emoji: '⌨️', wash: 'hsl(215 16% 90%)' },
		{ emoji: '📎', wash: 'hsl(20 18% 90%)' },
		{ emoji: '🔧', wash: 'hsl(200 18% 90%)' },
		{ emoji: '🧪', wash: 'hsl(165 22% 91%)' },
	],
	seasonal: [
		{ emoji: '🌸', wash: 'hsl(340 35% 92%)' },
		{ emoji: '🍃', wash: 'hsl(130 28% 90%)' },
		{ emoji: '🍂', wash: 'hsl(25 40% 90%)' },
		{ emoji: '❄️', wash: 'hsl(200 30% 92%)' },
		{ emoji: '🌙', wash: 'hsl(230 20% 90%)' },
		{ emoji: '☀️', wash: 'hsl(42 50% 91%)' },
	],
	calm: [
		{ emoji: '🕊️', wash: 'hsl(200 18% 92%)' },
		{ emoji: '☁️', wash: 'hsl(210 16% 93%)' },
		{ emoji: '🫧', wash: 'hsl(190 25% 92%)' },
		{ emoji: '🫖', wash: 'hsl(15 22% 90%)' },
		{ emoji: '🌊', wash: 'hsl(195 28% 90%)' },
		{ emoji: '🕯️', wash: 'hsl(35 28% 91%)' },
	],
}

export interface StickerPlacement {
	emoji: string
	wash: string
	/** 相对卡片 % */
	left: number
	top: number
	size: number
	rotate: number
	opacity: number
}

/** 简易可复现 PRNG */
export function mulberry32(seed: number): () => number {
	let a = seed >>> 0
	return () => {
		a = (a + 0x6d2b79f5) >>> 0
		let t = a
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

/**
 * 允许落点区（避开邮票右上、换一句右下、标题主字）：
 * - 标题左侧竖条
 * - 正文下方横带
 * - 中右留白（邮票下方）
 */
const ZONES: { left: [number, number]; top: [number, number]; size: [number, number] }[] = [
	{ left: [2, 14], top: [28, 58], size: [1.55, 1.95] },
	{ left: [12, 62], top: [72, 90], size: [1.35, 1.75] },
	{ left: [58, 78], top: [42, 62], size: [1.25, 1.65] },
]

function dist(a: { left: number; top: number }, b: { left: number; top: number }) {
	const dx = a.left - b.left
	const dy = (a.top - b.top) * 0.85
	return Math.hypot(dx, dy)
}

/** 抽 2–3 枚贴纸并排布；seed 变化即重掷 */
export function layoutGreetingStickers(
	kind: GreetingKind,
	seed: number,
	count = 0,
): StickerPlacement[] {
	const rand = mulberry32(seed ^ 0x9e3779b9)
	const pool = KIND_GLYPHS[kind]
	const n = count || 2 + (rand() < 0.55 ? 1 : 0) // 2 或 3
	const picks: DecorGlyph[] = []
	const used = new Set<number>()
	for (let i = 0; i < n; i++) {
		let idx = Math.floor(rand() * pool.length)
		for (let t = 0; t < 8 && used.has(idx); t++) idx = Math.floor(rand() * pool.length)
		used.add(idx)
		picks.push(pool[idx])
	}

	const placed: StickerPlacement[] = []
	const minGap = 16
	for (let i = 0; i < picks.length; i++) {
		const zone = ZONES[i % ZONES.length]
		let best: StickerPlacement | null = null
		for (let attempt = 0; attempt < 18; attempt++) {
			const left = zone.left[0] + rand() * (zone.left[1] - zone.left[0])
			const top = zone.top[0] + rand() * (zone.top[1] - zone.top[0])
			const size = zone.size[0] + rand() * (zone.size[1] - zone.size[0])
			const rotate = -18 + rand() * 36
			const opacity = 0.72 + rand() * 0.22
			const cand: StickerPlacement = {
				emoji: picks[i].emoji,
				wash: picks[i].wash,
				left,
				top,
				size,
				rotate,
				opacity,
			}
			if (placed.every((p) => dist(p, cand) >= minGap)) {
				best = cand
				break
			}
			if (!best) best = cand
		}
		if (best) placed.push(best)
	}
	return placed
}
