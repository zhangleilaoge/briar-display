import { addStatus } from '../../status'
import type { TraitPluginFactory } from '../types'
import { hasTrait } from './helpers'

// 地狱火：伤害施加灼烧（%最大生命/秒真伤）+ 重伤；档位变量 HPBurnPerSecond 缺省继承 1%
export const inferno: TraitPluginFactory = (params) => {
	const duration = params.Duration ?? 3
	const burnPct = (params['{2c202877}'] ?? 1) / 100
	const wound = (params.WoundPercent ?? 33) / 100
	return {
		onDealDamage(side, src, dst, _type, _amount, ctx) {
			if (!hasTrait(src, 'DA_18_Inferno') || !dst.alive) return
			ctx.burn(dst, dst.stats.maxHp * burnPct, duration)
			addStatus(dst, { kind: 'wound', until: ctx.t + duration, value: wound })
		},
	}
}

// 帝王斑蝶：伤害施加 4 秒双抗击碎（引擎 shred = 双抗 x0.7，官方 ShredPercent=30）
export const caustic: TraitPluginFactory = (params) => {
	const duration = params.ShredDuration ?? 4
	return {
		onDealDamage(side, src, dst, _type, _amount, ctx) {
			if (!hasTrait(src, 'DA_18_Caustic') || !dst.alive) return
			ctx.shred(dst, duration)
		},
	}
}

// 裁决使：(3)起伤害附加流血（3 秒真伤 DoT = 结算伤害 x BleedPercent）；技能暴击走 ability-crit 标签
export const executioner: TraitPluginFactory = (params, bp) => {
	const bleedPct = params['{2c61751d}'] ?? 0.3
	const duration = params.BleedDuration ?? 3
	if (bp < 1) return {}
	return {
		onDealDamage(side, src, dst, _type, amount, ctx) {
			if (!hasTrait(src, 'DA_18_Executioner') || !dst.alive || !amount) return
			// bleed 允许叠层（status 框架对 bleed 不去重）
			dst.statuses.push({
				kind: 'bleed',
				until: ctx.t + duration,
				value: (amount * bleedPct) / duration,
			})
		},
	}
}

// 绝命花妖：参与击杀回蓝 10；(2)起额外治疗最残友军 8% 最大生命；致命丽花纹章携带者效能 x1.5
export const floraFatalis: TraitPluginFactory = (params, bp) => {
	const mana = params.Mana ?? 10
	const healPct = params.PercentHeal ?? 0.08
	return {
		onKill(side, killer, _victim, ctx) {
			if (!hasTrait(killer, 'DA_FloraFatalis18')) return
			const amp = killer.traitAmp?.DA_FloraFatalis18 ?? 1
			killer.mana = Math.min(killer.stats.mana, killer.mana + mana * amp)
			if (bp < 1) return
			const lowest = ctx
				.sideUnits(side)
				.filter((a) => a.hp < a.stats.maxHp)
				.sort((a, b) => a.hp / a.stats.maxHp - b.hp / b.stats.maxHp)[0]
			if (lowest) ctx.heal(lowest, lowest.stats.maxHp * healPct * amp)
		},
	}
}
