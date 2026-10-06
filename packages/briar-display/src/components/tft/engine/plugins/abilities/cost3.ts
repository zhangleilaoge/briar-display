import { hexDistance } from '../../hex'
import type { AbilityCtx, AbilityPlugin, PluginUnit } from '../types'

/** 3 费技能数值基准（官方数值未收录，按费用/星级梯度手调） */
const M: [number, number, number] = [300, 540, 970]
const SHIELD: [number, number, number] = [320, 575, 1040]
const HEAL: [number, number, number] = [240, 430, 780]

/** 按距离排序取前 n 个敌人 */
const nearestN = (ctx: AbilityCtx, n: number): PluginUnit[] =>
	ctx
		.enemies()
		.sort((a, b) => hexDistance(ctx.unit.cpos, a.cpos) - hexDistance(ctx.unit.cpos, b.cpos))
		.slice(0, n)

/** 生命比例最低的敌人 */
const lowestHpPct = (enemies: PluginUnit[]): PluginUnit | null =>
	[...enemies].sort((a, b) => a.hp / a.stats.maxHp - b.hp / b.stats.maxHp)[0] ?? null

/** 魔战士形态：AD/AP 较高者决定 */
const adForm = (u: PluginUnit) => u.stats.attackDamage >= u.stats.abilityPower

export const COST3_ABILITIES: Record<string, AbilityPlugin> = {
	// 阿兹尔：召唤 2 个沙兵并加速，随后数次攻击改为指挥沙兵齐射（魔法伤害）
	DA_18_Azir: {
		cast(ctx) {
			for (let i = 0; i < 2; i++) {
				ctx.summon('DA_Summon_AzirSoldier', {
					near: ctx.unit.cpos,
					hp: ctx.perStar([360, 650, 1170]),
					ad: ctx.perStar([50, 90, 160]),
				})
			}
			ctx.unit.mem.commands = 3
			ctx.buff(ctx.unit, { attackSpeed: 0.6 }, 4)
			ctx.castFx(ctx.unit.cpos, { spell: 'buff' })
		},
		onAttack(ctx, target) {
			if ((ctx.unit.mem.commands ?? 0) <= 0) return
			ctx.unit.mem.commands -= 1
			const soldiers = ctx.allies().filter((a) => a.apiName === 'DA_Summon_AzirSoldier').length
			for (let i = 0; i < Math.max(1, soldiers); i++) {
				ctx.damage(target, ctx.perStar([110, 200, 360]) * ctx.scaleOf('magic'), 'magic', {
					canCrit: false,
				})
			}
		},
	},
	// 卡西奥佩娅：向目标和最近的未中毒敌人投毒，持续 4 秒魔法伤害 DoT（引擎 burn 不叠加，取最大档近似）
	DA_18_Cassiopeia: {
		cast(ctx) {
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!t) return
			const dps = (ctx.perStar(M) * ctx.scaleOf('magic')) / 4
			ctx.castFx(t.cpos, { spell: 'damage' })
			ctx.burn(t, dps, 4)
			const other = ctx
				.enemies()
				.filter((e) => e.uid !== t.uid && !ctx.isBurning(e))
				.sort((a, b) => hexDistance(ctx.unit.cpos, a.cpos) - hexDistance(ctx.unit.cpos, b.cpos))[0]
			if (other) ctx.burn(other, dps, 4)
		},
	},
	// 黛安娜：获得护盾，5 颗月光法球由 2 格内敌人分摊（每颗魔法伤害）
	DA_18_Diana: {
		cast(ctx) {
			ctx.shield(ctx.unit, ctx.perStar(SHIELD) * ctx.scaleOf('magic'))
			const foes = ctx.enemiesInRange(ctx.unit.cpos, 2)
			ctx.castFx(ctx.unit.cpos, { aoe: 2, spell: 'damage' })
			const orb = ctx.perStar([70, 125, 230]) * ctx.scaleOf('magic')
			if (foes.length === 0) {
				const t = ctx.currentTarget() ?? ctx.nearestEnemy()
				if (t) ctx.damage(t, orb * 5, 'magic')
				return
			}
			for (let i = 0; i < 5; i++) ctx.damage(foes[i % foes.length], orb, 'magic')
		},
	},
	// 赫卡里姆：3 秒双抗 + 持续回复，幽魂骑兵打击最近 2 名敌人（魔法伤害+晕眩）
	DA_18_Hecarim: {
		cast(ctx) {
			ctx.buff(ctx.unit, { armor: 60, magicResist: 60 }, 3)
			ctx.unit.mem.hotLeft = 3
			ctx.castFx(ctx.unit.cpos, { spell: 'buff' })
			for (const e of nearestN(ctx, 2)) {
				ctx.castFx(e.cpos, { spell: 'damage' })
				ctx.damage(e, ctx.perStar(M) * ctx.scaleOf('magic'), 'magic')
				ctx.applyStatus(e, { kind: 'stun', value: 0, seconds: 1.25 })
			}
		},
		onTick(ctx) {
			if ((ctx.unit.mem.hotLeft ?? 0) <= 0) return
			ctx.unit.mem.hotLeft -= 0.1
			ctx.heal(ctx.unit, (ctx.perStar(HEAL) * ctx.scaleOf('magic') * 0.1) / 3)
		},
	},
	// 卡兹克：跃向 3 格内最远敌人造成魔法伤害；孤立无援（邻格无敌军）增伤并回蓝；宿敌联动在 gameLoop
	DA_18_KhaZix: {
		cast(ctx) {
			const inRange = ctx.enemies().filter((e) => hexDistance(ctx.unit.cpos, e.cpos) <= 3)
			const t =
				[...inRange].sort(
					(a, b) => hexDistance(ctx.unit.cpos, b.cpos) - hexDistance(ctx.unit.cpos, a.cpos),
				)[0] ?? ctx.nearestEnemy()
			if (!t) return
			ctx.dashTo(ctx.unit, t)
			ctx.unit.target = t.uid
			const isolated =
				ctx.enemies().filter((e) => e.uid !== t.uid && hexDistance(t.cpos, e.cpos) <= 1).length ===
				0
			ctx.castFx(t.cpos, { spell: 'damage' })
			ctx.damage(t, ctx.perStar(M) * ctx.scaleOf('magic') * (isolated ? 1.8 : 1), 'magic')
			if (isolated) ctx.unit.mana = Math.min(ctx.unit.stats.mana, ctx.unit.mana + 15)
		},
	},
	// 易：每第三次攻击双重打击（额外一次普攻）；AD 形态叠攻速、AP 形态附伤+自疗；击杀获得爆发移速（近似为短时攻速）
	DA_18_MasterYi_AD: {
		cast(ctx) {
			ctx.castFx(ctx.unit.cpos, { spell: 'buff' })
		},
		onAttack(ctx, target) {
			if (ctx.unit.attackCount % 3 !== 0) return
			ctx.damage(target, ctx.unit.stats.attackDamage, 'physical')
			if (adForm(ctx.unit)) {
				ctx.buff(ctx.unit, { attackSpeed: 0.12 }, 4)
			} else {
				ctx.damage(target, ctx.perStar([70, 125, 230]) * ctx.scaleOf('magic'), 'magic', {
					canCrit: false,
				})
				ctx.heal(ctx.unit, ctx.perStar(HEAL) * 0.5 * ctx.scaleOf('magic'))
			}
		},
		onKill(ctx) {
			ctx.buff(ctx.unit, { attackSpeed: 0.6 }, 2)
		},
	},
	// 拉莫斯：嘲讽 2 格内敌人 3 秒 + 护盾 + 双抗；护盾被打破时对 1 格内敌人造成物理伤害（护甲+魔抗加成）
	DA_18_Rammus: {
		cast(ctx) {
			for (const e of ctx.enemiesInRange(ctx.unit.cpos, 2)) {
				ctx.applyStatus(e, { kind: 'taunt', value: 0, seconds: 3, source: ctx.unit.uid })
			}
			ctx.shield(ctx.unit, ctx.perStar(SHIELD) * ctx.scaleOf('magic'))
			ctx.buff(ctx.unit, { armor: 60, magicResist: 60 }, 4)
			ctx.unit.mem.shieldArmed = 1
			ctx.castFx(ctx.unit.cpos, { aoe: 2, spell: 'shield' })
		},
		onDamaged(ctx) {
			if (!ctx.unit.mem.shieldArmed || ctx.unit.shield > 0) return
			ctx.unit.mem.shieldArmed = 0
			const dmg =
				ctx.perStar(M) * ctx.scaleOf('physical') +
				(ctx.unit.stats.armor + ctx.unit.stats.magicResist) * 0.5
			ctx.castFx(ctx.unit.cpos, { aoe: 1, spell: 'damage' })
			for (const e of ctx.enemiesInRange(ctx.unit.cpos, 1)) {
				ctx.damage(e, dmg, 'physical')
			}
		},
	},
	// 雷恩加尔：跳向 3 格内生命比例最低的敌人造成物理伤害，并按已损失生命自疗（有上限）；宿敌联动在 gameLoop
	DA_18_Rengar: {
		cast(ctx) {
			const inRange = ctx.enemies().filter((e) => hexDistance(ctx.unit.cpos, e.cpos) <= 3)
			const t = lowestHpPct(inRange.length > 0 ? inRange : ctx.enemies())
			if (!t) return
			ctx.dashTo(ctx.unit, t)
			ctx.unit.target = t.uid
			ctx.castFx(t.cpos, { spell: 'damage' })
			ctx.damage(t, ctx.perStar(M) * ctx.scaleOf('physical'), 'physical')
			const missing = ctx.unit.stats.maxHp - ctx.unit.hp
			ctx.heal(ctx.unit, Math.min(missing * 0.6, ctx.perStar(HEAL) * ctx.scaleOf('magic')))
		},
	},
	// 崔丝塔娜：给当前目标挂爆炸火花 4 秒（期间攻速提升、普攻为火花充能），
	// 结束后对目标 2 格内敌人分摊爆发（基础伤害+充能额外伤害）；目标阵亡火花随换目标转移
	DA_18_Tristana: {
		cast(ctx) {
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!t) return
			ctx.unit.mem.sparkOn = 1
			ctx.unit.mem.sparkUntil = ctx.t + 4
			ctx.unit.mem.sparkDmg = 0
			ctx.buff(ctx.unit, { attackSpeed: 0.6 }, 4)
			ctx.castFx(t.cpos, { spell: 'buff' })
		},
		onAttack(ctx) {
			if (!ctx.unit.mem.sparkOn) return
			ctx.unit.mem.sparkDmg += ctx.perStar([35, 63, 115]) * ctx.scaleOf('physical')
		},
		onTick(ctx) {
			if (!ctx.unit.mem.sparkOn || ctx.t < (ctx.unit.mem.sparkUntil ?? 0)) return
			ctx.unit.mem.sparkOn = 0
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!t) return
			const foes = ctx.enemiesInRange(t.cpos, 2)
			if (foes.length === 0) return
			const total = ctx.perStar(M) * ctx.scaleOf('physical') + (ctx.unit.mem.sparkDmg ?? 0)
			ctx.castFx(t.cpos, { aoe: 2, spell: 'damage' })
			for (const e of foes) ctx.damage(e, total / foes.length, 'physical')
		},
	},
	// 深红锋喙鸟：召唤 4 只小锋喙鸟，自身每次攻击时小鸟协同攻击（每只附加物理伤害）；
	// 橙霸符：造成物理伤害时击碎敌人护甲（引擎 shred 同时削魔抗，近似）
	DA_CrimsonRaptor18: {
		cast(ctx) {
			for (let i = 0; i < 4; i++) {
				ctx.summon('TFT_RazorbeakMini', {
					near: ctx.unit.cpos,
					hp: ctx.perStar([220, 400, 720]),
					ad: ctx.perStar([28, 50, 92]),
				})
			}
			ctx.castFx(ctx.unit.cpos, { aoe: 2, spell: 'buff' })
		},
		onAttack(ctx, target) {
			const chicks = ctx.allies().filter((a) => a.apiName === 'TFT_RazorbeakMini').length
			for (let i = 0; i < chicks; i++) {
				ctx.damage(target, ctx.perStar([25, 45, 80]) * ctx.scaleOf('physical'), 'physical', {
					canCrit: false,
				})
			}
		},
		onDealDamage(ctx, dst, type) {
			if (ctx.unit.alphaMark && type === 'physical') ctx.shred(dst, 4)
		},
	},
	// 费德提克：使最近 2 名敌人魔抗击碎，随后 2 秒持续汲取（每秒魔法伤害+自疗）
	DA_Fiddlesticks18: {
		cast(ctx) {
			ctx.unit.mem.channel = 2
			for (const e of nearestN(ctx, 2)) ctx.shred(e, 4)
			ctx.castFx(ctx.unit.cpos, { spell: 'damage' })
		},
		onTick(ctx) {
			if ((ctx.unit.mem.channel ?? 0) <= 0) return
			ctx.unit.mem.channel -= 0.1
			const targets = nearestN(ctx, 2)
			const dmg = (ctx.perStar(M) * ctx.scaleOf('magic') * 0.1) / 2
			for (const e of targets) ctx.damage(e, dmg, 'magic', { canCrit: false })
			ctx.heal(ctx.unit, (ctx.perStar(HEAL) * ctx.scaleOf('magic') * 0.1) / 2)
		},
	},
	// 克格莫：AD 形态向目标及最近另一敌人喷酸（低血敌人增伤），AP 形态对目标持续伤害
	DA_KogMaw18_AD: {
		cast(ctx) {
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!t) return
			if (adForm(ctx.unit)) {
				const other = ctx
					.enemies()
					.filter((e) => e.uid !== t.uid)
					.sort((a, b) => hexDistance(t.cpos, a.cpos) - hexDistance(t.cpos, b.cpos))[0]
				const base = ctx.perStar(M) * ctx.scaleOf('physical')
				for (const e of [t, other]) {
					if (!e) continue
					ctx.castFx(e.cpos, { spell: 'damage' })
					ctx.damage(e, base * (e.hp < e.stats.maxHp * 0.5 ? 1.5 : 1), 'physical')
				}
			} else {
				ctx.castFx(t.cpos, { spell: 'damage' })
				ctx.burn(t, (ctx.perStar(M) * ctx.scaleOf('magic')) / 4, 4)
			}
		},
	},
	// 远古石甲虫：主动回复最大生命并滚向目标造成物理伤害（生命加成）；
	// 阵亡分裂 2 个小型石甲虫（按比例继承）并各自嘲讽 2 格内敌人；蓝灰霸符：阵亡时给全队护盾
	DA_Krug18: {
		cast(ctx) {
			ctx.heal(ctx.unit, ctx.unit.stats.maxHp * 0.15)
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!t) return
			ctx.dashTo(ctx.unit, t)
			ctx.castFx(t.cpos, { spell: 'damage' })
			ctx.damage(
				t,
				ctx.perStar(M) * ctx.scaleOf('physical') + ctx.unit.stats.maxHp * 0.08,
				'physical',
			)
		},
		onDeath(ctx) {
			for (let i = 0; i < 2; i++) {
				const s = ctx.summon('TFT_Krug', {
					near: ctx.unit.cpos,
					hp: Math.round(ctx.unit.stats.maxHp * 0.5),
					ad: Math.round(ctx.unit.stats.attackDamage * 0.6),
				})
				if (s) {
					for (const e of ctx.enemiesInRange(s.cpos, 2)) {
						ctx.applyStatus(e, { kind: 'taunt', value: 0, seconds: 2, source: s.uid })
					}
				}
			}
			if (ctx.unit.alphaMark) {
				for (const a of ctx.allies()) ctx.shield(a, a.stats.maxHp * 0.15)
			}
		},
	},
	// 蔚：被动攻击回血；主动怒吼自疗并获得攻速、伤害减免与控制免疫（5 秒）
	DA_Vi18: {
		onAttack(ctx) {
			ctx.heal(ctx.unit, ctx.perStar([30, 55, 100]))
		},
		cast(ctx) {
			ctx.heal(ctx.unit, ctx.perStar(HEAL) * ctx.scaleOf('magic'))
			ctx.buff(ctx.unit, { attackSpeed: 0.5, damageReduction: 0.25 }, 5)
			ctx.applyStatus(ctx.unit, { kind: 'ccImmune', value: 0, seconds: 5 })
			ctx.castFx(ctx.unit.cpos, { spell: 'buff' })
		},
	},
}
