import type { TraitPluginFactory } from '../types'
import { hasTrait } from './helpers'

// 宿敌：收集参与击杀（击杀另一宿敌 +3）；雷恩加尔每 2 次参与击杀提供 3 金币（metric 上报 gameLoop）；
// 累计 8 次后全队 +5% AD，此后每次 +0.2%（战斗内即时生效）。卡兹克进化的羁绊选择 UI 在 gameLoop 侧
/** 雷恩加尔金币结算：每 per 次参与击杀给 gold 金币 */
export const RIVAL_TAKEDOWN_GOLD = { per: 2, gold: 3 }
export const rival: TraitPluginFactory = (params, bp) => {
	const adStackReq = params['{a6d81c50}'] ?? 8
	const thresholdAd = params['{a1ab72d6}'] ?? 0.05
	const adPerStack = params['{f1f3dbfc}'] ?? 0.002
	let takedowns = 0
	return {
		onKill(side, killer, victim, ctx) {
			if (!hasTrait(killer, 'DA_18_Rival')) return
			const bonus = hasTrait(victim, 'DA_18_Rival') ? 3 : 1
			takedowns += bonus
			ctx.metric('rivalTakedowns', bonus)
			// 雷恩加尔团队 AD（bp2 档位变量；低档位无此变量时跳过）
			if (bp >= 1) {
				if (takedowns >= adStackReq && takedowns - bonus < adStackReq) {
					for (const u of ctx.sideUnits(side)) u.stats.attackDamage *= 1 + thresholdAd
				} else if (takedowns > adStackReq) {
					for (const u of ctx.sideUnits(side)) u.stats.attackDamage *= 1 + adPerStack
				}
			}
		},
	}
}
