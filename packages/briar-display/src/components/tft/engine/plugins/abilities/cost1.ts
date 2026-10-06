import type { AbilityPlugin, PluginUnit } from '../types'

/** 1 费技能数值基准（官方数值 CD 未收录，按费用/星级梯度手调） */
const M: [number, number, number] = [150, 270, 490]
const SHIELD: [number, number, number] = [180, 320, 580]
const HEAL: [number, number, number] = [120, 220, 400]

const isBurning = (u: PluginUnit) => ((u as unknown as { burnLeft?: number }).burnLeft ?? 0) > 0

export const COST1_ABILITIES: Record<string, AbilityPlugin> = {
	// 阿卡丽：对目标造成物理伤害，灼烧中目标额外伤害；击杀则再次施放
	DA_18_Akali_AD: {
		cast(ctx) {
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!t) return
			const fire = isBurning(t)
			const dmg = ctx.perStar(M) * ctx.scaleOf('physical') * (fire ? 1.5 : 1)
			ctx.castFx(t.cpos, { spell: 'damage' })
			const dealt = ctx.damage(t, dmg, 'physical')
			if (!t.alive && dealt > 0 && ctx.unit.castCount < 8) {
				const nxt = ctx.nearestEnemy()
				if (nxt) ctx.damage(nxt, dmg, 'physical')
			}
		},
	},
	// 卡蜜尔：切割目标造成伤害并获得护盾
	DA_18_Camille: {
		cast(ctx) {
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!t) return
			ctx.castFx(t.cpos, { spell: 'damage' })
			ctx.damage(t, ctx.perStar(M) * ctx.scaleOf('physical'), 'physical')
			ctx.shield(ctx.unit, ctx.perStar(SHIELD) * ctx.scaleOf('magic'))
		},
	},
	// 可酷伯：持续回复生命，下一次攻击替换为猛击
	DA_18_Kobuko: {
		cast(ctx) {
			ctx.castFx(ctx.unit.cpos, { spell: 'heal' })
			ctx.heal(ctx.unit, ctx.perStar(HEAL) * ctx.scaleOf('magic'))
			ctx.unit.mem.empowered = ctx.perStar(M) * ctx.scaleOf('magic')
		},
		modifyAttack(ctx) {
			const bonus = ctx.unit.mem.empowered ?? 0
			if (bonus <= 0) return ctx.unit.stats.attackDamage
			ctx.unit.mem.empowered = 0
			ctx.fx({
				type: 'damage',
				uid: ctx.unit.uid,
				target: ctx.currentTarget()?.uid,
				value: Math.round(bonus),
			})
			return ctx.unit.stats.attackDamage + bonus
		},
	},
	// 蕾欧娜：被动开战获得双抗并衰减；主动猛击目标造成伤害和晕眩
	DA_18_Leona: {
		onCombatStart(ctx) {
			ctx.buff(ctx.unit, { armor: 40, magicResist: 40 }, 6)
		},
		cast(ctx) {
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!t) return
			ctx.castFx(t.cpos, { spell: 'damage' })
			ctx.damage(t, ctx.perStar(M) * ctx.scaleOf('magic') + ctx.unit.stats.armor * 1.5, 'magic')
			ctx.applyStatus(t, { kind: 'stun', value: 0, seconds: 1.5 })
		},
	},
	// 奥恩：护盾 + 锥形范围伤害；锻炉能量任务在 gameLoop 结算
	DA_18_Ornn: {
		cast(ctx) {
			ctx.shield(ctx.unit, ctx.perStar(SHIELD) * ctx.scaleOf('magic'))
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!t) return
			ctx.castFx(t.cpos, { aoe: 1, spell: 'damage' })
			for (const e of ctx.enemiesInRange(t.cpos, 1)) {
				ctx.damage(e, ctx.perStar(M) * ctx.scaleOf('magic'), 'magic')
			}
		},
	},
	// 洛：护盾 + 为伤害最高的友军提供衰减攻速
	DA_18_Rakan: {
		cast(ctx) {
			ctx.shield(ctx.unit, ctx.perStar(SHIELD) * ctx.scaleOf('magic'))
			const best = ctx
				.allies()
				.filter((a) => a.uid !== ctx.unit.uid)
				.sort(
					(a, b) =>
						((b as { damageDealt?: number }).damageDealt ?? 0) -
						((a as { damageDealt?: number }).damageDealt ?? 0),
				)[0]
			if (best) ctx.buff(best, { attackSpeed: 0.4 }, 4)
			ctx.castFx(ctx.unit.cpos, { spell: 'shield' })
		},
	},
	// 雷克塞：破土而出，邻格敌人晕眩 + 伤害；被动每秒回复
	DA_18_RekSai: {
		onTick(ctx) {
			if (ctx.unit.hp < ctx.unit.stats.maxHp) ctx.heal(ctx.unit, ctx.unit.stats.maxHp * 0.003)
		},
		cast(ctx) {
			ctx.castFx(ctx.unit.cpos, { aoe: 1, spell: 'damage' })
			for (const e of ctx.enemiesInRange(ctx.unit.cpos, 1)) {
				ctx.damage(e, ctx.perStar(M) * ctx.scaleOf('magic'), 'magic')
				ctx.applyStatus(e, { kind: 'stun', value: 0, seconds: 1.25 })
			}
		},
	},
	// 苍蓝哨戒：引导激光 3 秒，持续伤害 + 魔抗击碎；青霸符：引导期间回蓝
	DA_18_Sentry: {
		cast(ctx) {
			ctx.unit.mem.channel = 3
			ctx.castFx(ctx.currentTarget()?.cpos ?? ctx.unit.cpos, { spell: 'damage' })
		},
		onTick(ctx) {
			if ((ctx.unit.mem.channel ?? 0) <= 0) return
			ctx.unit.mem.channel -= 0.1
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!t) return
			ctx.damage(t, ctx.perStar([40, 72, 130]) * ctx.scaleOf('magic') * 0.1, 'magic', {
				canCrit: false,
			})
			ctx.applyStatus(t, { kind: 'manaReave', value: 0, seconds: 0.2 })
			if (ctx.unit.alphaMark) ctx.unit.mana = Math.min(ctx.unit.stats.mana, ctx.unit.mana + 0.8)
		},
	},
	// 韦鲁斯：蓄力后向敌人最多的直线射出箭矢，穿透递减
	DA_18_Varus: {
		cast(ctx) {
			const t = ctx.bestLineTarget() ?? ctx.nearestEnemy()
			if (!t) return
			ctx.castFx(t.cpos, { spell: 'damage' })
			let mult = 1
			for (const e of ctx.enemiesOnLine(ctx.unit.cpos, t.cpos)) {
				ctx.damage(e, ctx.perStar(M) * ctx.scaleOf('physical') * mult, 'physical')
				mult = Math.max(0.4, mult - 0.15)
			}
		},
	},
	// 维迦：巨大震波，低血目标伤害提升；击杀永久获得法强
	DA_18_Veigar: {
		cast(ctx) {
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!t) return
			const low = t.hp < t.stats.maxHp * 0.5
			ctx.castFx(t.cpos, { spell: 'damage' })
			ctx.damage(t, ctx.perStar(M) * ctx.scaleOf('magic') * (low ? 1.6 : 1), 'magic')
		},
		onKill(ctx) {
			ctx.unit.stats.abilityPower += 1
		},
	},
	// 霞：下 4 次攻击获得攻速并被替换为羽刃（额外伤害+护甲削减）
	DA_18_Xayah: {
		cast(ctx) {
			ctx.unit.mem.feathers = 4
			ctx.buff(ctx.unit, { attackSpeed: 0.5 }, 4)
			ctx.castFx(ctx.unit.cpos, { spell: 'buff' })
		},
		onAttack(ctx, target) {
			if ((ctx.unit.mem.feathers ?? 0) <= 0) return
			ctx.unit.mem.feathers -= 1
			ctx.damage(target, ctx.perStar([45, 80, 145]) * ctx.scaleOf('physical'), 'physical')
			ctx.applyStatus(target, { kind: 'slow', value: 0.15, seconds: 2 })
		},
	},
	// 约里克：阵亡时生成嘲讽游灵；主动回复并打击目标
	DA_18_Yorick: {
		cast(ctx) {
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			ctx.heal(ctx.unit, ctx.perStar(HEAL) * ctx.scaleOf('magic'))
			if (t) {
				ctx.castFx(t.cpos, { spell: 'damage' })
				ctx.damage(t, ctx.perStar(M) * ctx.scaleOf('physical'), 'physical')
			}
		},
		onDeath(ctx) {
			const w = ctx.summon('TFT_Voidspawn', {
				hp: Math.round(ctx.unit.stats.maxHp * 0.6),
				ad: Math.round(ctx.unit.stats.attackDamage * 0.5),
			})
			if (w) {
				for (const e of ctx.enemiesInRange(w.cpos, 2)) {
					ctx.applyStatus(e, { kind: 'taunt', value: 0, seconds: 2, source: w.uid })
				}
			}
		},
	},
	// 绯红树怪：刃叶聚拢伤害+重伤+灼烧；绯红霸符：每次施放获得物理加成
	DA_Cinderling18: {
		cast(ctx) {
			if (ctx.unit.alphaMark) ctx.unit.stats.attackDamage *= 1.15
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!t) return
			ctx.castFx(t.cpos, { spell: 'damage' })
			ctx.damage(t, ctx.perStar(M) * ctx.scaleOf('physical'), 'physical')
			ctx.applyStatus(t, { kind: 'wound', value: 0.33, seconds: 4 })
		},
		onDealDamage(ctx, dst) {
			ctx.burn(dst, dst.stats.maxHp * 0.01, 3)
		},
	},
	// 卡尔玛：系住目标持续伤害，随后爆裂范围伤害+减速
	DA_Karma18: {
		cast(ctx) {
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!t) return
			ctx.castFx(t.cpos, { aoe: 1, spell: 'damage' })
			ctx.damage(t, ctx.perStar(M) * ctx.scaleOf('magic'), 'magic')
			for (const e of ctx.enemiesInRange(t.cpos, 1)) {
				ctx.damage(e, ctx.perStar([80, 145, 260]) * ctx.scaleOf('magic'), 'magic')
				ctx.applyStatus(e, { kind: 'slow', value: 0.25, seconds: 3 })
			}
		},
	},
}
