import type { AbilityCtx, AbilityPlugin } from '../types'

/** 2 费技能数值基准（官方数值未收录，按费用/星级梯度手调） */
const M: [number, number, number] = [200, 360, 650]
const SHIELD: [number, number, number] = [220, 400, 720]
const HEAL: [number, number, number] = [160, 290, 520]
const INF = Number.POSITIVE_INFINITY

/** 生命比例最低的敌人（无则最近） */
const lowestHpEnemy = (ctx: AbilityCtx) =>
	ctx.enemies().sort((a, b) => a.hp / a.stats.maxHp - b.hp / b.stats.maxHp)[0] ?? null

export const COST2_ABILITIES: Record<string, AbilityPlugin> = {
	// 阿利斯塔：怒吼自疗+净化、治疗两名最残友军，然后猛击目标造成魔法伤害和晕眩
	DA_18_Alistar: {
		cast(ctx) {
			ctx.castFx(ctx.unit.cpos, { spell: 'heal' })
			ctx.cleanse(ctx.unit)
			ctx.heal(ctx.unit, ctx.perStar(HEAL) * ctx.scaleOf('magic') + ctx.unit.stats.maxHp * 0.08)
			const wounded = ctx
				.allies()
				.filter((a) => a.uid !== ctx.unit.uid)
				.sort((a, b) => a.hp / a.stats.maxHp - b.hp / b.stats.maxHp)
				.slice(0, 2)
			for (const a of wounded) ctx.heal(a, ctx.perStar([120, 220, 400]) * ctx.scaleOf('magic'))
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!t) return
			ctx.castFx(t.cpos, { spell: 'damage' })
			ctx.damage(t, ctx.perStar(M) * ctx.scaleOf('magic'), 'magic')
			ctx.applyStatus(t, { kind: 'stun', value: 0, seconds: 1.5 })
		},
	},
	// 凯特琳：被动——每第三次攻击替换为爆头，提高本次攻击伤害
	DA_18_Caitlyn: {
		modifyAttack(ctx, _target, raw) {
			if (ctx.unit.attackCount % 3 !== 0) return raw
			const bonus = ctx.perStar([90, 160, 290]) * ctx.scaleOf('physical')
			ctx.fx({
				type: 'damage',
				uid: ctx.unit.uid,
				target: ctx.currentTarget()?.uid,
				value: Math.round(bonus),
			})
			return raw + bonus
		},
	},
	// 伊莉丝：变身加最大生命值并回满差额，蜘蛛形态攻击附带魔法伤害和治疗；后续施放衰减攻速
	DA_18_Elise: {
		cast(ctx) {
			if (ctx.unit.mem.spider) {
				ctx.buff(ctx.unit, { attackSpeed: 0.5 }, 3)
			} else {
				ctx.unit.mem.spider = 1
				const bonus = Math.round(ctx.unit.stats.maxHp * 0.25)
				ctx.unit.stats.maxHp += bonus
				ctx.heal(ctx.unit, bonus)
			}
			ctx.castFx(ctx.unit.cpos, { spell: 'buff' })
		},
		onAttack(ctx, target) {
			if (!ctx.unit.mem.spider) return
			ctx.damage(target, ctx.perStar([40, 72, 130]) * ctx.scaleOf('magic'), 'magic')
			ctx.heal(ctx.unit, ctx.perStar([40, 72, 130]) * ctx.scaleOf('magic'))
		},
	},
	// 凯尔：飞升随星级——1★普攻附魔伤、2★+魔抗击碎、3★+目标周围冲击波
	DA_18_Kayle: {
		onAttack(ctx, target) {
			if (ctx.unit.star < 1) return
			ctx.damage(target, ctx.perStar([25, 45, 80]) * ctx.scaleOf('magic'), 'magic', {
				canCrit: false,
			})
			if (ctx.unit.star >= 2) ctx.shred(target, 3)
			if (ctx.unit.star >= 3) {
				ctx.castFx(target.cpos, { aoe: 1, spell: 'damage' })
				for (const e of ctx.enemiesInRange(target.cpos, 1)) {
					if (e.uid === target.uid) continue
					ctx.damage(e, ctx.perStar([50, 90, 160]) * ctx.scaleOf('magic'), 'magic', {
						canCrit: false,
					})
				}
			}
		},
	},
	// 乐芙兰：向目标发射镜像造成伤害，邻格敌人受次级伤害（复制被动在 gameLoop 结算，不在此实现）
	DA_18_LeBlanc: {
		cast(ctx) {
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!t) return
			ctx.castFx(t.cpos, { aoe: 1, spell: 'damage' })
			ctx.damage(t, ctx.perStar(M) * ctx.scaleOf('magic'), 'magic')
			for (const e of ctx.enemiesInRange(t.cpos, 1)) {
				if (e.uid === t.uid) continue
				ctx.damage(e, ctx.perStar([100, 180, 330]) * ctx.scaleOf('magic'), 'magic')
			}
		},
	},
	// 瑟庄妮：获得护盾，锥形顺劈范围伤害，再沿直线打击
	DA_18_Sejuani: {
		cast(ctx) {
			ctx.shield(ctx.unit, ctx.perStar(SHIELD) * ctx.scaleOf('magic'))
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!t) {
				ctx.castFx(ctx.unit.cpos, { spell: 'shield' })
				return
			}
			ctx.castFx(t.cpos, { aoe: 1, spell: 'damage' })
			for (const e of ctx.enemiesInRange(t.cpos, 1)) {
				ctx.damage(e, ctx.perStar(M) * ctx.scaleOf('magic'), 'magic')
			}
			for (const e of ctx.enemiesOnLine(ctx.unit.cpos, t.cpos)) {
				ctx.damage(e, ctx.perStar([150, 270, 490]) * ctx.scaleOf('magic'), 'magic')
			}
		},
	},
	// 慎：为自己和附近一名受伤友军提供护盾与攻速；附加魔伤因 hook 按单位触发只作用于慎自身
	DA_18_Shen: {
		cast(ctx) {
			ctx.shield(ctx.unit, ctx.perStar(SHIELD) * ctx.scaleOf('magic'))
			const ally =
				ctx
					.alliesInRange(ctx.unit.cpos, 2)
					.filter((a) => a.uid !== ctx.unit.uid && a.hp < a.stats.maxHp)
					.sort((a, b) => a.hp / a.stats.maxHp - b.hp / b.stats.maxHp)[0] ?? null
			if (ally) ctx.shield(ally, ctx.perStar([180, 320, 580]) * ctx.scaleOf('magic'))
			ctx.unit.mem.blade = 3
			ctx.buff(ctx.unit, { attackSpeed: 0.4 }, 4)
			if (ally) ctx.buff(ally, { attackSpeed: 0.4 }, 4)
			ctx.castFx(ctx.unit.cpos, { spell: 'shield' })
		},
		onAttack(ctx, target) {
			if ((ctx.unit.mem.blade ?? 0) <= 0) return
			ctx.unit.mem.blade -= 1
			ctx.damage(target, ctx.perStar([40, 72, 130]) * ctx.scaleOf('magic'), 'magic', {
				canCrit: false,
			})
		},
	},
	// 提莫：两簇蘑菇砸向最近的敌人，再摔出巨型蘑菇重创目标（采集小游戏不做）
	DA_18_Teemo: {
		cast(ctx) {
			const near = ctx
				.enemies()
				.sort((a, b) => a.hp / a.stats.maxHp - b.hp / b.stats.maxHp)
				.slice(0, 2)
			for (const e of near) {
				ctx.castFx(e.cpos, { aoe: 1, spell: 'damage' })
				ctx.damage(e, ctx.perStar([120, 215, 390]) * ctx.scaleOf('magic'), 'magic')
			}
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!t) return
			ctx.castFx(t.cpos, { aoe: 2, spell: 'damage' })
			ctx.damage(t, ctx.perStar([260, 470, 850]) * ctx.scaleOf('magic'), 'magic')
		},
	},
	// 沃里克：撕咬目标造成物理伤害，按伤害治疗自身并获得持续到战斗结束的攻速
	DA_18_Warwick: {
		cast(ctx) {
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!t) return
			ctx.castFx(t.cpos, { spell: 'damage' })
			const dealt = ctx.damage(t, ctx.perStar(M) * ctx.scaleOf('physical'), 'physical')
			ctx.heal(ctx.unit, dealt * 0.6)
			ctx.unit.stats.attackSpeed += 0.25
			ctx.castFx(ctx.unit.cpos, { spell: 'buff' })
		},
	},
	// 芸阿娜：突进至目标身侧，法球造成物理伤害并分裂给附近敌人
	DA_18_Yunara: {
		cast(ctx) {
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!t) return
			ctx.dashTo(ctx.unit, t)
			ctx.castFx(t.cpos, { aoe: 1, spell: 'damage' })
			ctx.damage(t, ctx.perStar(M) * ctx.scaleOf('physical'), 'physical')
			let n = 0
			for (const e of ctx.enemiesInRange(t.cpos, 1)) {
				if (e.uid === t.uid || n >= 2) continue
				n += 1
				ctx.damage(e, ctx.perStar([90, 160, 290]) * ctx.scaleOf('physical'), 'physical')
			}
		},
	},
	// 魔沼蛙：毒泡泡命中爆炸造成魔法伤害并灼烧一圈敌人，目标被大幅减速；紫霸符周期获得法强
	DA_Gromp18_AP: {
		cast(ctx) {
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!t) return
			ctx.castFx(t.cpos, { aoe: 1, spell: 'damage' })
			ctx.damage(t, ctx.perStar([160, 290, 520]) * ctx.scaleOf('magic'), 'magic')
			ctx.applyStatus(t, { kind: 'slow', value: 0.4, seconds: 3 })
			for (const e of ctx.enemiesInRange(t.cpos, 1)) {
				ctx.burn(e, ctx.perStar([30, 54, 98]) * ctx.scaleOf('magic'), 4)
			}
		},
		onTick(ctx) {
			if (!ctx.unit.alphaMark) return
			ctx.unit.mem.grompT = (ctx.unit.mem.grompT ?? 0) - 0.1
			if (ctx.unit.mem.grompT <= 0) {
				ctx.unit.mem.grompT = 6
				ctx.unit.stats.abilityPower += 15
				ctx.castFx(ctx.unit.cpos, { spell: 'buff' })
			}
		},
	},
	// 暗影狼：跃向生命最低的敌人造成物理伤害，接下来数次攻击加攻速并附加物理伤害；灰霸符给技能暴击与暴击率
	DA_Murkwolf18: {
		onCombatStart(ctx) {
			if (!ctx.unit.alphaMark) return
			ctx.buff(ctx.unit, { critChance: 0.2 }, INF)
		},
		cast(ctx) {
			const t = lowestHpEnemy(ctx) ?? ctx.nearestEnemy()
			if (!t) return
			ctx.dashTo(ctx.unit, t)
			ctx.castFx(t.cpos, { spell: 'damage' })
			ctx.damage(t, ctx.perStar([220, 400, 720]) * ctx.scaleOf('physical'), 'physical')
			ctx.unit.mem.emp = 3
			ctx.buff(ctx.unit, { attackSpeed: 0.5 }, 3)
		},
		onAttack(ctx, target) {
			if ((ctx.unit.mem.emp ?? 0) <= 0) return
			ctx.unit.mem.emp -= 1
			ctx.damage(target, ctx.perStar([50, 90, 160]) * ctx.scaleOf('physical'), 'physical')
		},
	},
	// 峡谷迅捷蟹：被动攻击替换为舞蹈，对邻格所有敌人造成物理伤害；主动钻地获得护盾并持续回复
	DA_Scuttlecrab18: {
		modifyAttack(ctx, _target, _raw) {
			for (const e of ctx.enemiesInRange(ctx.unit.cpos, 1)) {
				ctx.damage(e, ctx.perStar([70, 125, 230]) * ctx.scaleOf('physical'), 'physical')
			}
			return 0
		},
		cast(ctx) {
			ctx.unit.mem.burrow = 3
			ctx.shield(ctx.unit, ctx.perStar([200, 360, 650]) * ctx.scaleOf('magic'))
			ctx.castFx(ctx.unit.cpos, { spell: 'shield' })
		},
		onTick(ctx) {
			if ((ctx.unit.mem.burrow ?? 0) > 0) {
				ctx.unit.mem.burrow -= 0.1
				ctx.heal(ctx.unit, (ctx.perStar(HEAL) * ctx.scaleOf('magic') * 0.1) / 3)
			}
			ctx.unit.mem.crabCd = Math.max(0, (ctx.unit.mem.crabCd ?? 0) - 0.1)
		},
		// 绿霸符：友军跌下阈值生命值时回复其最大生命值（内置冷却）
		onAllyDamaged(ctx, ally) {
			if (!ctx.unit.alphaMark || (ctx.unit.mem.crabCd ?? 0) > 0) return
			if (ally.hp >= ally.stats.maxHp * 0.4) return
			ctx.unit.mem.crabCd = 4
			ctx.heal(ally, ally.stats.maxHp * 0.12)
			ctx.fx({ type: 'heal', uid: ctx.unit.uid, target: ally.uid })
		},
	},
}
