/**
 * 问候明信片分类贴纸：同一 kind 共用视觉家族（扁平裸 emoji）。
 * 落在明信片外圈光环，换一句时换 seed 重掷，并保证间距。
 */

import type { GreetingKind } from './daily-greetings'

export interface DecorGlyph {
	/** 精选扁平 emoji（无白底圆章、非 Fluent 立体贴纸） */
	emoji: string
}

/** 每类 5–6 个候选；渲染时抽 2–3 个 */
export const KIND_GLYPHS: Record<GreetingKind, readonly DecorGlyph[]> = {
	proverb: [
		{ emoji: '📜' },
		{ emoji: '🖋️' },
		{ emoji: '🍵' },
		{ emoji: '🎋' },
		{ emoji: '📖' },
		{ emoji: '🏛️' },
	],
	joke: [
		{ emoji: '😄' },
		{ emoji: '🎭' },
		{ emoji: '✨' },
		{ emoji: '🐱' },
		{ emoji: '🃏' },
		{ emoji: '🎈' },
	],
	encourage: [
		{ emoji: '🌟' },
		{ emoji: '🌱' },
		{ emoji: '🚀' },
		{ emoji: '💪' },
		{ emoji: '🌻' },
		{ emoji: '🔥' },
	],
	witty: [
		{ emoji: '💡' },
		{ emoji: '🧩' },
		{ emoji: '⌨️' },
		{ emoji: '📎' },
		{ emoji: '🔧' },
		{ emoji: '🧪' },
	],
	seasonal: [
		{ emoji: '🌸' },
		{ emoji: '🍃' },
		{ emoji: '🍂' },
		{ emoji: '❄️' },
		{ emoji: '🌙' },
		{ emoji: '☀️' },
	],
	calm: [
		{ emoji: '🕊️' },
		{ emoji: '☁️' },
		{ emoji: '🫧' },
		{ emoji: '🌿' },
		{ emoji: '🌊' },
		{ emoji: '🕯️' },
	],
}

export interface StickerPlacement {
	emoji: string
	/** 相对定位容器 %（可超出 0–100，挂在卡片外缘） */
	left: number
	top: number
	/** rem；约为旧版 1.5–2× */
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
 * 外圈光环落点（相对明信片堆叠容器）：
 * 避开白卡正文区、右上邮戳、右下「换一句」。
 * 坐标可略出 0–100，让贴纸贴在卡片外缘。
 */
const RING_ZONES: { left: [number, number]; top: [number, number]; size: [number, number] }[] = [
	// 左缘光环（落在加大后的左右 padding 里，不压正文）
	{ left: [1, 8], top: [22, 44], size: [2.5, 3.3] },
	{ left: [1, 9], top: [52, 76], size: [2.4, 3.2] },
	// 顶缘光环（pt 区，避开右上邮戳）
	{ left: [14, 42], top: [1, 10], size: [2.6, 3.4] },
	{ left: [44, 68], top: [2, 11], size: [2.4, 3.1] },
	// 右缘光环（邮戳下方）
	{ left: [91, 99], top: [34, 56], size: [2.5, 3.3] },
	{ left: [90, 98], top: [58, 78], size: [2.4, 3.1] },
	// 底缘光环（避开右下换一句）
	{ left: [14, 48], top: [90, 99], size: [2.6, 3.4] },
	{ left: [50, 78], top: [91, 99], size: [2.4, 3.2] },
]

function dist(a: { left: number; top: number }, b: { left: number; top: number }) {
	const dx = a.left - b.left
	const dy = (a.top - b.top) * 0.85
	return Math.hypot(dx, dy)
}

/** 抽 2–3 枚贴纸并排布在外圈；seed 变化即重掷 */
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

	// 打乱可用边区，保证同屏不挤在同一侧
	const zoneOrder = RING_ZONES.map((_, i) => i)
	for (let i = zoneOrder.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1))
		;[zoneOrder[i], zoneOrder[j]] = [zoneOrder[j], zoneOrder[i]]
	}

	const placed: StickerPlacement[] = []
	const minGap = 22
	for (let i = 0; i < picks.length; i++) {
		const zone = RING_ZONES[zoneOrder[i % zoneOrder.length]]
		let best: StickerPlacement | null = null
		for (let attempt = 0; attempt < 24; attempt++) {
			const left = zone.left[0] + rand() * (zone.left[1] - zone.left[0])
			const top = zone.top[0] + rand() * (zone.top[1] - zone.top[0])
			const size = zone.size[0] + rand() * (zone.size[1] - zone.size[0])
			const rotate = -22 + rand() * 44
			const opacity = 0.88 + rand() * 0.12
			const cand: StickerPlacement = {
				emoji: picks[i].emoji,
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
