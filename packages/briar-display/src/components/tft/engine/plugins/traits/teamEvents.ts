import type { TraitPluginFactory } from '../types'
import { hasTrait, oncePerTick, reentryGuard } from './helpers'

// 日月双蚀：开战 10 秒后处决生命比例最低的敌人，之后每 3.5 秒重复
export const eclipse: TraitPluginFactory = (params) => {
	const delay = params.DelaySeconds ?? 10
	const period = params['{53db05e8}'] ?? 3.5
	let nextAt = delay
	const tick = oncePerTick()
	return {
		onTick(side, _units, ctx) {
			tick(ctx.t, () => {
				if (ctx.t < nextAt) return
				nextAt += period
				const lowest = ctx
					.sideUnits(side === 'A' ? 'B' : 'A')
					.sort((a, b) => a.hp / a.stats.maxHp - b.hp / b.stats.maxHp)[0]
				if (!lowest) return
				ctx.castFx(lowest.cpos, { aoe: 0, spell: 'damage' })
				// 处决：覆盖护盾+剩余生命（DR 抵消后仍能击杀）
				ctx.damage(lowest, (lowest.hp + lowest.shield) * 2 + 50, 'true')
			})
		},
	}
}

// 日蚀骑士：全队 5% 最大生命护盾 + 8% 附加魔法伤害，每个不同 3 星弈子 +1%；
// 3 个 3 星：全队 +15% 攻速 +15 双抗；5 个：附加伤害的 40% 转真实；8 个飞升 4 星（引擎星级上限 3，略）
export const solar: TraitPluginFactory = (params) => {
	const shieldRatio = params.ShieldRatio ?? 0.05
	const bonusMagic = params.BonusMagicDamage ?? 0.08
	const per3Star = params['{a51b2ace}'] ?? 0.01
	const n1 = params['{092e2b2b}'] ?? 3
	const n2 = params['{0a2e2cbe}'] ?? 5
	const t1AS = params['{617a160e}'] ?? 0.15
	const t1Res = params['{7e77da03}'] ?? 15
	const trueConv = params['{5cfe766f}'] ?? 0.4
	let n3 = 0
	let ratio = 0
	const guard = reentryGuard()
	return {
		onCombatStart(side, units, ctx) {
			n3 = new Set(units.filter((u) => u.star === 3).map((u) => u.apiName)).size
			ratio = bonusMagic * (1 + per3Star * n3)
			const shieldPct = shieldRatio * (1 + per3Star * n3)
			for (const u of ctx.sideUnits(side)) {
				ctx.shield(u, u.stats.maxHp * shieldPct)
				if (n3 >= n1) {
					u.stats.attackSpeed += u.stats.attackSpeed * t1AS
					u.stats.armor += t1Res
					u.stats.magicResist += t1Res
				}
			}
		},
		onDealDamage(_side, _src, dst, _type, amount, ctx) {
			if (!dst.alive || !amount || ratio <= 0) return
			guard(() => {
				const extra = amount * ratio
				if (n3 >= n2) {
					ctx.damage(dst, extra * trueConv, 'true')
					ctx.damage(dst, extra * (1 - trueConv), 'magic')
				} else {
					ctx.damage(dst, extra, 'magic')
				}
			})
		},
	}
}

// 重装战士：开战及首次跌破 50% 生命时获得 10 秒最大生命护盾；(6)持盾时 +5% 减伤
export const vanguard: TraitPluginFactory = (params, bp) => {
	const shieldPct = params.MaxHealthShield ?? 0.18
	const threshold = params.HealthThreshold ?? 0.5
	const shieldSeconds = params.ShieldDuration ?? 10
	const drWhileShielded = bp >= 2 ? (params['{b58e0b6e}'] ?? 0.05) : 0
	return {
		onCombatStart(_side, units, ctx) {
			for (const u of units) {
				if (!hasTrait(u, 'DA_18_Vanguard')) continue
				ctx.shield(u, u.stats.maxHp * shieldPct)
				if (drWhileShielded) ctx.buff(u, { damageReduction: drWhileShielded }, shieldSeconds)
			}
		},
		onDamaged(_side, u, _amount, ctx) {
			if (!hasTrait(u, 'DA_18_Vanguard') || u.mem.vgProc) return
			if (u.hp > u.stats.maxHp * threshold) return
			u.mem.vgProc = 1
			ctx.shield(u, u.stats.maxHp * shieldPct)
			if (drWhileShielded) ctx.buff(u, { damageReduction: drWhileShielded }, shieldSeconds)
		},
	}
}

// 狂战士：对低于 50% 生命的单位，额外伤害翻倍（附加伤害 = 结算伤害 x amp/(1+总增伤)）
export const slayer: TraitPluginFactory = (params) => {
	const amp = params['{a9a813e7}'] ?? 0.12
	const lowHp = params['{bef0ca90}'] ?? 0.5
	const guard = reentryGuard()
	return {
		onDealDamage(side, src, dst, type, amount, ctx) {
			if (!hasTrait(src, 'DA_18_Slayer') || !dst.alive || !amount) return
			if (dst.hp / dst.stats.maxHp >= lowHp) return
			guard(() => {
				ctx.damage(dst, (amount * amp) / (1 + src.stats.damageAmp), type)
			})
		},
	}
}
