import type { PluginUnit, TraitPluginFactory } from '../types'
import { hasTrait, oncePerTick } from './helpers'

// 法师：每个法师施放技能后，全体法师 +1%/+1%/+2% 法术加成（永久，可叠加）
export const spellweaver: TraitPluginFactory = (params) => {
	const perCast = (params.APPerCast ?? 0.01) * 100
	return {
		onCast(side, u, ctx) {
			if (!hasTrait(u, 'DA_18_Spellweaver')) return
			for (const m of ctx.sideUnits(side)) {
				if (hasTrait(m, 'DA_18_Spellweaver')) m.stats.abilityPower += perCast
			}
		},
	}
}

// 迅捷射手：每次攻击 +ASperAttack 攻速（乘基础攻速），至多 MaxStacks 层
export const rapidfire: TraitPluginFactory = (params) => {
	const perAttack = params.ASperAttack ?? 0.03
	const maxStacks = params.MaxStacks ?? 10
	return {
		onCombatStart(_side, units) {
			for (const u of units) {
				if (hasTrait(u, 'DA_18_Rapidfire')) u.mem.rfBase = u.stats.attackSpeed
			}
		},
		onAttack(_side, u) {
			if (!hasTrait(u, 'DA_18_Rapidfire')) return
			if ((u.mem.rfStacks ?? 0) >= maxStacks) return
			u.mem.rfStacks = (u.mem.rfStacks ?? 0) + 1
			u.stats.attackSpeed += (u.mem.rfBase ?? u.stats.attackSpeed) * perAttack
		},
	}
}

// 猎人：3 秒未切换目标后获得 10% 伤害增幅，切换目标即失效
export const hunter: TraitPluginFactory = (params) => {
	const needSeconds = params['{83011ee7}'] ?? 3
	const amp = params.DamageAmp ?? 0.1
	// 闭包表：uid → 当前追踪目标/开始时间/是否已生效
	const track = new Map<string, { tgt: string | null; since: number; on: boolean }>()
	return {
		onAttack(side, u, target, ctx) {
			if (!hasTrait(u, 'DA_18_Hunter')) return
			const s = track.get(u.uid) ?? { tgt: null, since: ctx.t, on: false }
			if (s.tgt !== target.uid) {
				if (s.on) u.stats.damageAmp -= amp
				track.set(u.uid, { tgt: target.uid, since: ctx.t, on: false })
			}
		},
		onTick(side, _units, ctx) {
			for (const u of ctx.sideUnits(side)) {
				if (!hasTrait(u, 'DA_18_Hunter')) continue
				const s = track.get(u.uid)
				if (!s || s.on || !s.tgt) continue
				if (ctx.t - s.since >= needSeconds) {
					u.stats.damageAmp += amp
					s.on = true
				}
			}
		},
	}
}

// 魔岩巨兽：每被一名敌人选中为目标，+10 双抗（动态 reconcile）
export const battlemage: TraitPluginFactory = (params) => {
	const resists = params.Resists ?? 10
	const tick = oncePerTick()
	return {
		onTick(side, _units, ctx) {
			tick(ctx.t, () => {
				const enemies = ctx.sideUnits(side === 'A' ? 'B' : 'A')
				for (const u of ctx.sideUnits(side)) {
					if (!hasTrait(u, 'DA_18_Battlemage')) continue
					const n = enemies.filter((e) => e.target === u.uid).length
					const want = n * resists
					const cur = u.mem.bmRes ?? 0
					if (want !== cur) {
						u.stats.armor += want - cur
						u.stats.magicResist += want - cur
						u.mem.bmRes = want
					}
				}
			})
		},
	}
}

// 远古树精：3 格内敌人阵亡时，最强茂凯 +30 永久最大生命（metric 上报 gameLoop 跨场累计）
/** 每层永久生命的官方变量键（跨战斗结算与战斗内插件同一数据源） */
export const MAOKAI_STACK_HP_VAR = '{36e69059}'
export const maokaiStack: TraitPluginFactory = (params) => {
	const range = params['{56607148}'] ?? 3
	const hpPerStack = params[MAOKAI_STACK_HP_VAR] ?? 30
	const strongest = (units: PluginUnit[]) =>
		units
			.filter((u) => u.apiName === 'DA_18_Maokai')
			.sort((a, b) => b.star - a.star || b.stats.maxHp - a.stats.maxHp)[0]
	return {
		onKill(side, _killer, victim, ctx) {
			const mao = strongest(ctx.sideUnits(side))
			if (!mao) return
			const dc = Math.abs(mao.cpos.col - victim.cpos.col)
			const dr = Math.abs(mao.cpos.row - victim.cpos.row)
			if (Math.max(dc, dr, Math.abs(dc + dr)) > range) return
			mao.stats.maxHp += hpPerStack
			mao.hp += hpPerStack
			ctx.metric('maokaiStacks', 1)
		},
	}
}

// 峡谷野怪 (7+)：战斗开始时及之后每 5 秒成长（乘区 AD/AP/AS +5%，护甲+1/魔抗+5/生命+50/回蓝+5）
export const riftbeastGrowth: TraitPluginFactory = (params, bp) => {
	if (bp < 2) return {}
	const ad = 1 + (params['{0776b071}'] ?? 0.05)
	const as = 1 + (params['{4e1998f4}'] ?? 0.05)
	const ap = (params['{1b76cfed}'] ?? 0.05) * 100
	const armor = params['{3230276c}'] ?? 1
	const mr = params['{a8c6eeaf}'] ?? 5
	const hp = params['{08cfb22e}'] ?? 50
	const manaRegen = params['{0d6c2c87}'] ?? 5
	const grow = (u: PluginUnit) => {
		u.stats.attackDamage *= ad
		u.stats.attackSpeed *= as
		u.stats.abilityPower += ap
		u.stats.armor += armor
		u.stats.magicResist += mr
		u.stats.maxHp += hp
		u.hp += hp
		u.stats.manaRegen += manaRegen
	}
	let nextGrow = 0
	const tick = oncePerTick()
	return {
		onCombatStart(_side, units) {
			for (const u of units) if (hasTrait(u, 'DA_Riftbeast18')) grow(u)
			nextGrow = 5
		},
		onTick(side, _units, ctx) {
			tick(ctx.t, () => {
				if (ctx.t < nextGrow) return
				nextGrow += 5
				for (const u of ctx.sideUnits(side)) {
					if (hasTrait(u, 'DA_Riftbeast18')) grow(u)
				}
			})
		},
	}
}
