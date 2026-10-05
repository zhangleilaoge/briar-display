import { CHAMPION_BY_API, TRAIT_BY_API } from '../data/set18'
import { itemGrantedTrait } from './items'
import type { BoardUnit } from './types'

export interface ActiveTrait {
	apiName: string
	count: number
	/** 已激活的最高档位索引；-1 = 未达首档 */
	breakpointIndex: number
}

/** 统计上场羁绊：同名棋子每个拷贝都计数（官方规则），纹章类装备 +1 */
export function traitCounts(board: BoardUnit[]): Map<string, number> {
	const counts = new Map<string, number>()
	for (const u of board) {
		const c = CHAMPION_BY_API.get(u.apiName)
		if (!c) continue
		for (const t of c.traits) counts.set(t, (counts.get(t) ?? 0) + 1)
		for (const itemApi of u.items) {
			const t = itemGrantedTrait(itemApi)
			if (t) counts.set(t, (counts.get(t) ?? 0) + 1)
		}
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
