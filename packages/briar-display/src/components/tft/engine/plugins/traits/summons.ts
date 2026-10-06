import type { StarLevel } from '../../types'
import type { TraitPluginFactory } from '../types'

// 永恒之森：开战召唤可放置植物（简化为自动落在阵型附近）
// (3)石皮树+生命花 (5)第二棵石皮树且石皮树+200 生命 (7)+深林守卫 (9)植物 2 星 (11)植物 3 星
const STAR_MULT = [1, 1.8, 3.24]
export const elderwood: TraitPluginFactory = (params, bp) => {
	const stonebarkBonus = bp >= 1 ? (params['{b027c2f9}'] ?? 200) : 0
	const star = (bp >= 4 ? 3 : bp >= 3 ? 2 : 1) as StarLevel
	const mult = STAR_MULT[star - 1]
	// 引擎对 monster 召唤不做星级放大，显式按星级缩放面板
	const plant = (baseHp: number, baseAd: number, bonusHp = 0) => ({
		hp: Math.round(baseHp * mult + bonusHp),
		ad: Math.round(baseAd * mult),
		star,
	})
	return {
		onCombatStart(_side, units, ctx) {
			const near = units[0]?.cpos
			ctx.summon('DA_Summon_Stonebark', { near, ...plant(1500, 40, stonebarkBonus) })
			ctx.summon('DA_Summon_Lifebloom', { near, ...plant(700, 50) })
			if (bp >= 1) ctx.summon('DA_Summon_Stonebark', { near, ...plant(1500, 40, stonebarkBonus) })
			if (bp >= 2) ctx.summon('DA_Summon_ForestGuard', { near, ...plant(2200, 120) })
		},
	}
}

// 约德尔人和朋友：召唤毛茸茸大朋友；骑乘者（取最强约德尔，拖拽选择 UI 待做）获得生命/攻速
export const sprykin: TraitPluginFactory = (params) => {
	const hpPct = params.HealthIncrease ?? 0.15
	const asPct = params.AttackSpeedIncrease ?? 0.15
	return {
		onCombatStart(side, units, ctx) {
			ctx.summon('DA_Summon_BigFriend')
			const rider = units
				.filter((u) => u.alive && u.side === side)
				.sort((a, b) => b.star - a.star || b.stats.attackDamage - a.stats.attackDamage)[0]
			if (!rider) return
			rider.stats.maxHp *= 1 + hpPct
			rider.hp = rider.stats.maxHp
			rider.stats.attackSpeed += rider.stats.attackSpeed * asPct
		},
	}
}

// 召唤师：强化召唤物（约里克小鬼 +30% 生命 / 阿兹尔士兵 +20% 伤害 / 婕拉植物 +20% 伤害近似「+4 攻击次数」）
// (3) 每种效果加成提升 50%
const SUMMON_BUFFS: Record<string, 'hp' | 'ad'> = {
	TFT_Voidspawn: 'hp',
	DA_Summon_AzirSoldier: 'ad',
	DA_Summon_ZyraPlant: 'ad',
}
export const summoner: TraitPluginFactory = (params, bp) => {
	const mult = bp >= 1 ? 1.5 : 1
	const hpMult = (params['{5311f791}'] ?? 0.3) * mult
	const adMult = Math.max(params['{6bba9a92}'] ?? 0.2, 0.2) * mult
	return {
		onTick(side, units) {
			for (const u of units) {
				const kind = SUMMON_BUFFS[u.apiName]
				if (!kind || u.mem.sumBuff) continue
				u.mem.sumBuff = 1
				if (kind === 'hp') {
					const gain = u.stats.maxHp * hpMult
					u.stats.maxHp += gain
					u.hp += gain
				} else {
					u.stats.attackDamage *= 1 + adMult
				}
			}
		},
	}
}
