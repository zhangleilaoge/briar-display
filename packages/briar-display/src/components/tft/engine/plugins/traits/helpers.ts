import { CHAMPION_BY_API } from '../../../data/set18'
import type { PluginUnit } from '../types'

/** 棋子是否属于某羁绊（召唤物无 champion 条目，天然 false）；拉克丝选定的羁绊算成员 */
export const hasTrait = (u: PluginUnit, traitApi: string): boolean =>
	(CHAMPION_BY_API.get(u.apiName)?.traits.includes(traitApi) ?? false) || u.chosenTrait === traitApi

/** onDealDamage 里再造成伤害时的重入保护（附加伤害不再触发本羁绊钩子） */
export const reentryGuard = (): ((fn: () => void) => void) => {
	let firing = false
	return (fn) => {
		if (firing) return
		firing = true
		try {
			fn()
		} finally {
			firing = false
		}
	}
}

/** 羁绊 onTick 在每存活单位身上各触发一次，按 tick 去重 */
export const oncePerTick = (): ((t: number, fn: () => void) => void) => {
	let lastT = -1
	return (t, fn) => {
		if (t === lastT) return
		lastT = t
		fn()
	}
}
