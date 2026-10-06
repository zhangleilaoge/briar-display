import { CHAMPION_BY_API, TRAIT_BY_API } from '../data/set18'
import { itemGrantedTrait } from './items'
import { isLux, luxFormOf } from './lux'
import type { BoardUnit } from './types'

export interface ActiveTrait {
	apiName: string
	count: number
	/** 已激活的最高档位索引；-1 = 未达首档 */
	breakpointIndex: number
}

/** 统计上场羁绊：同名棋子每个拷贝都计数（官方规则），纹章类装备 +1；顶级掠食者羁绊计 2；拉克丝为选定羁绊 +2 */
export function traitCounts(board: BoardUnit[]): Map<string, number> {
	const counts = new Map<string, number>()
	for (const u of board) {
		const c = CHAMPION_BY_API.get(u.apiName)
		if (!c) continue
		for (const t of c.traits) counts.set(t, (counts.get(t) ?? 0) + 1)
		// 顶级掠食者「提供 +2 峡谷野怪」：自身已计 1，再补 1
		if (c.traits.includes('DA_18_ApexPredator')) {
			counts.set('DA_Riftbeast18', (counts.get('DA_Riftbeast18') ?? 0) + 1)
		}
		// 大元素使拉克丝：为选定羁绊提供 +2 计数（官方规则）；其他单位未来若带 chosenTrait 计 +1
		if (u.chosenTrait) {
			const bonus = isLux(u.apiName) ? 2 : 1
			counts.set(u.chosenTrait, (counts.get(u.chosenTrait) ?? 0) + bonus)
		}
		for (const itemApi of u.items) {
			const t = itemGrantedTrait(itemApi)
			if (t) counts.set(t, (counts.get(t) ?? 0) + 1)
		}
	}
	// 日月双蚀：月蚀+日蚀形态拉克丝同时登场即激活（CD 数据无成员棋子）
	const forms = new Set(
		board.map((u) =>
			isLux(u.apiName) && u.chosenTrait
				? (luxFormOf(u.chosenTrait)?.apiName ?? u.apiName)
				: u.apiName,
		),
	)
	if (forms.has('DA_18_Lux_Moonbeam') && forms.has('DA_18_Lux_Sunbeam')) {
		counts.set('DA_18_Eclipse', 1)
	}
	return counts
}

/** 激活的羁绊列表（已达首档） */
export function computeActiveTraits(board: BoardUnit[]): ActiveTrait[] {
	const counts = traitCounts(board)
	const out: ActiveTrait[] = []
	for (const [apiName, count] of counts) {
		const def = TRAIT_BY_API.get(apiName)
		if (!def) continue
		let breakpointIndex = -1
		for (let i = 0; i < def.breakpoints.length; i++) {
			if (count >= def.breakpoints[i]) breakpointIndex = i
		}
		if (breakpointIndex >= 0) out.push({ apiName, count, breakpointIndex })
	}
	return out.sort((a, b) => b.count - a.count)
}
