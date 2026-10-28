/**
 * 门户 / 想法页共用：受限随机贴纸布局。
 * - 只落空白区（避开中部卡片/文字）
 * - 贴纸 AABB 互不重叠
 * - 尺寸随 kind
 */

export type ScrapPage = 'portal' | 'thoughts'

export type ScrapZone = {
	id: string
	/** 归一化 0–100 的可用矩形（viewport） */
	x: number
	y: number
	w: number
	h: number
}

/** 门户：问候卡左右、搜索条两侧外、小组件行左右与下方 */
export const PORTAL_ZONES: ScrapZone[] = [
	{ id: 'greet-L', x: 0.5, y: 10, w: 16, h: 28 },
	{ id: 'greet-R', x: 83.5, y: 10, w: 16, h: 28 },
	{ id: 'search-L', x: 0.5, y: 40, w: 14, h: 12 },
	{ id: 'search-R', x: 85.5, y: 40, w: 14, h: 12 },
	{ id: 'widget-L', x: 0.5, y: 54, w: 12, h: 28 },
	{ id: 'widget-R', x: 87.5, y: 54, w: 12, h: 28 },
	{ id: 'below', x: 18, y: 86, w: 64, h: 12 },
]

/** 想法页：左右空白与列表下方，避开居中 max-w-2xl 记一笔/卡片 */
export const THOUGHTS_ZONES: ScrapZone[] = [
	{ id: 'top-L', x: 0.5, y: 8, w: 14, h: 22 },
	{ id: 'top-R', x: 85.5, y: 8, w: 14, h: 22 },
	{ id: 'mid-L', x: 0.5, y: 32, w: 13, h: 28 },
	{ id: 'mid-R', x: 86.5, y: 32, w: 13, h: 28 },
	{ id: 'low-L', x: 0.5, y: 62, w: 14, h: 22 },
	{ id: 'low-R', x: 85.5, y: 62, w: 14, h: 22 },
	{ id: 'below', x: 20, y: 88, w: 60, h: 10 },
]

export function zonesFor(page: ScrapPage): ScrapZone[] {
	return page === 'thoughts' ? THOUGHTS_ZONES : PORTAL_ZONES
}

export type ScrapBox = { x: number; y: number; w: number; h: number }

export function overlaps(a: ScrapBox, b: ScrapBox, pad = 1.2): boolean {
	return !(
		a.x + a.w + pad < b.x ||
		b.x + b.w + pad < a.x ||
		a.y + a.h + pad < b.y ||
		b.y + b.h + pad < a.y
	)
}

export function sizeForKind(
	kind: 'tall' | 'square' | 'wide',
	rand: () => number,
): { w: number; h: number } {
	switch (kind) {
		case 'tall':
			return { w: 4.5 + rand() * 2.2, h: 9 + rand() * 5 }
		case 'wide':
			return { w: 8 + rand() * 4, h: 4.2 + rand() * 2.2 }
		default:
			return { w: 5.5 + rand() * 2.8, h: 5.5 + rand() * 2.8 }
	}
}

export function mulberry32(seed: number): () => number {
	let a = seed >>> 0
	return () => {
		a |= 0
		a = (a + 0x6d2b79f5) | 0
		let t = Math.imul(a ^ (a >>> 15), 1 | a)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

export function hashStr(s: string): number {
	let h = 2166136261
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i)
		h = Math.imul(h, 16777619)
	}
	return h >>> 0
}
