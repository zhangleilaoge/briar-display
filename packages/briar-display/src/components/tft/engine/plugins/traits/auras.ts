import type { PluginUnit, TraitPluginFactory } from '../types'
import { hasTrait, oncePerTick } from './helpers'

// 月蚀骑士：自身及邻格友军 +AS%/AP%，月蚀骑士翻倍（LunarMultiplier=1 → x2）
export const lunar: TraitPluginFactory = (params) => {
	const asPct = params.AttackSpeed ?? 0.07
	const apPct = (params.AbilityPower ?? 0.07) * 100
	const mult = 1 + (params['{6d27fbd4}'] ?? 1)
	return {
		onCombatStart(_side, units, ctx) {
			// 每个友军取最高倍率（多月蚀邻格不叠）
			const bonus = new Map<string, number>()
			for (const u of units) {
				if (!hasTrait(u, 'DA_18_Lunar')) continue
				bonus.set(u.uid, mult)
				for (const a of ctx.alliesInRange(u.cpos, 1)) {
					if (a.uid === u.uid) continue
					bonus.set(a.uid, Math.max(bonus.get(a.uid) ?? 0, 1))
				}
			}
			for (const u of units) {
				const m = bonus.get(u.uid)
				if (!m) continue
				u.stats.attackSpeed += u.stats.attackSpeed * asPct * m
				u.stats.abilityPower += apPct * m
			}
		},
	}
}

// 魔战士：按 AD/AP 较高者获得增益（AD 乘区 / AP 固定点）
export const adaptor: TraitPluginFactory = (params) => {
	const gain = params['{0412779a}'] ?? 0.25
	return {
		onCombatStart(_side, units) {
			for (const u of units) {
				if (!hasTrait(u, 'DA_18_Adaptor')) continue
				if (u.stats.attackDamage >= u.stats.abilityPower) u.stats.attackDamage *= 1 + gain
				else u.stats.abilityPower += gain * 100
			}
		},
	}
}

// 荆棘之兴：全队 5% 减伤；>=6 株婕拉植物存活时升至 10%（动态 reconcile）
export const zyraPlants: TraitPluginFactory = (params) => {
	const base = params.BaseDurability ?? 0.05
	const needPlants = params['{7c65d9f5}'] ?? 6
	const raised = params['{8e1b920c}'] ?? 0.1
	const tick = oncePerTick()
	return {
		onTick(side, units, ctx) {
			tick(ctx.t, () => {
				const plants = units.filter((u) => u.apiName === 'DA_Summon_ZyraPlant').length
				const want = plants >= needPlants ? raised : base
				for (const u of ctx.sideUnits(side)) {
					const cur = u.mem.zyraDr ?? 0
					if (cur === want) continue
					u.stats.damageReduction += want - cur
					u.mem.zyraDr = want
				}
			})
		},
		onCombatStart(_side, units) {
			for (const u of units) {
				u.stats.damageReduction += base
				u.mem.zyraDr = base
			}
		},
	}
}

// 月华神女：最强拉露恩每次施法推进月相；偶数相全队减伤 7%，奇数相全队增伤 7%（月相周期的简化）
export const aluneMoon: TraitPluginFactory = (params) => {
	const dr = params.Durability ?? 0.07
	const amp = params.DamageAmp ?? 0.07
	let moon = 0
	const applied = new Map<string, number>() // uid → 0 未应用 / 1 减伤 / 2 增伤
	const applyMode = (units: PluginUnit[], mode: 1 | 2) => {
		for (const u of units) {
			const cur = applied.get(u.uid) ?? 0
			if (cur === mode) continue
			if (cur === 1) u.stats.damageReduction -= dr
			if (cur === 2) u.stats.damageAmp -= amp
			if (mode === 1) u.stats.damageReduction += dr
			else u.stats.damageAmp += amp
			applied.set(u.uid, mode)
		}
	}
	return {
		onCombatStart(_side, units) {
			applyMode(units, 1)
		},
		onCast(side, u, ctx) {
			if (u.apiName !== 'DA_18_Alune') return
			moon += 1
			applyMode(ctx.sideUnits(side), moon % 2 === 0 ? 1 : 2)
		},
	}
}

// 花仙子：队伍伤害吸引皮克斯（每 1200 队伍伤害 +1）；每只皮克斯给花仙子 +5%/+8% AD 与 +5/+8 AP；
// 花仙子跌破 50% 血时按皮克斯数治疗（每场一次）；满 7 只后转为黄金皮克斯（metric 上报金币）
/** 黄金皮克斯结算单价（金币/只），gameLoop 结算引用 */
export const FAE_PIXIE_GOLD = 3
export const fae: TraitPluginFactory = (params) => {
	const adap = params.ADAP ?? 5
	const healPerPixie = (params.Heal ?? 2.5) / 100
	const threshold = params.HealThreshold ?? 0.5
	let pixies = 0
	let damageAcc = 0
	const baseAd = new Map<string, number>()
	const appliedAd = new Map<string, number>()
	const appliedAp = new Map<string, number>()
	const applyPixies = (units: PluginUnit[]) => {
		for (const u of units) {
			if (!hasTrait(u, 'DA_18_Fae')) continue
			const base = baseAd.get(u.uid) ?? u.stats.attackDamage
			const wantAd = base * (adap / 100) * pixies
			const wantAp = adap * pixies
			u.stats.attackDamage += wantAd - (appliedAd.get(u.uid) ?? 0)
			u.stats.abilityPower += wantAp - (appliedAp.get(u.uid) ?? 0)
			appliedAd.set(u.uid, wantAd)
			appliedAp.set(u.uid, wantAp)
		}
	}
	return {
		onCombatStart(_side, units) {
			for (const u of units) {
				if (hasTrait(u, 'DA_18_Fae')) baseAd.set(u.uid, u.stats.attackDamage)
			}
		},
		onDealDamage(side, _src, _dst, _type, amount, ctx) {
			if (!amount) return
			damageAcc += amount
			while (damageAcc >= 1200) {
				damageAcc -= 1200
				pixies += 1
				if (pixies > 7) ctx.metric('faeGoldPixies', 1)
			}
			applyPixies(ctx.sideUnits(side))
		},
		onDamaged(side, u, _amount, ctx) {
			if (!hasTrait(u, 'DA_18_Fae') || pixies === 0) return
			if (u.mem.faeHealed || u.hp > u.stats.maxHp * threshold) return
			u.mem.faeHealed = 1
			ctx.heal(u, u.stats.maxHp * healPerPixie * pixies)
		},
	}
}
