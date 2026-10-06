import { BOARD_COLS, COMBAT_ROWS } from '../../../data/rules'
import { hexDistance } from '../../hex'
import type { HexPos } from '../../types'
import type { AbilityCtx, AbilityPlugin, PluginUnit } from '../types'

/** 4 费技能数值基准（官方数值 CD 未收录，按费用/星级梯度手调） */
const M: [number, number, number] = [400, 720, 1300]
const SHIELD: [number, number, number] = [380, 685, 1240]
const HEAL: [number, number, number] = [260, 470, 850]

const uidHash = (s: string) => {
	let h = 0
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
	return Math.abs(h)
}

/** 闪烁到远离 from 的空格（≤3 格内取离其最远者） */
const blinkAway = (ctx: AbilityCtx, from: PluginUnit) => {
	const occupied = new Set(
		[...ctx.enemies(), ...ctx.allies()].map((u) => `${u.cpos.col},${u.cpos.row}`),
	)
	let best: HexPos | null = null
	let bestScore = Number.NEGATIVE_INFINITY
	for (let col = 0; col < BOARD_COLS; col++) {
		for (let row = 0; row < COMBAT_ROWS; row++) {
			if (occupied.has(`${col},${row}`)) continue
			const p = { col, row }
			const dSelf = hexDistance(p, ctx.unit.cpos)
			if (dSelf > 3) continue
			const score = hexDistance(p, from.cpos) - dSelf * 0.5
			if (score > bestScore) {
				bestScore = score
				best = p
			}
		}
	}
	if (best) ctx.teleport(ctx.unit, best)
}

export const COST4_ABILITIES: Record<string, AbilityPlugin> = {
	// 阿狸：向敌人最密格投灵魄炸弹，半径 2 格内伤害按距离衰减
	DA_18_Ahri: {
		cast(ctx) {
			const center = ctx.densestEnemyHex()
			if (!center) return
			const base = ctx.perStar(M) * ctx.scaleOf('magic')
			ctx.castFx(center, { aoe: 2, spell: 'damage' })
			for (const e of ctx.enemiesInRange(center, 2)) {
				const fall = Math.max(0.4, 1 - 0.2 * hexDistance(e.cpos, center))
				ctx.damage(e, base * fall, 'magic')
			}
		},
	},
	// 厄斐琉斯：断魄连续挥击 5 次，随后月光由半径 2 格内敌人分摊
	DA_18_Aphelios: {
		cast(ctx) {
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!t) return
			ctx.unit.mem.swings = 5
			ctx.unit.mem.swingCd = 0
			ctx.castFx(t.cpos, { spell: 'buff' })
		},
		onTick(ctx) {
			if ((ctx.unit.mem.swings ?? 0) <= 0) return
			ctx.unit.mem.swingCd = (ctx.unit.mem.swingCd ?? 0) - 0.1
			if ((ctx.unit.mem.swingCd ?? 0) > 0) return
			ctx.unit.mem.swingCd = 0.25
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!t) {
				ctx.unit.mem.swings = 0
				return
			}
			ctx.unit.mem.swings -= 1
			ctx.damage(t, ctx.perStar([80, 145, 260]) * ctx.scaleOf('physical'), 'physical')
			if (ctx.unit.mem.swings > 0) return
			const victims = ctx.enemiesInRange(t.cpos, 2)
			if (victims.length === 0) return
			const pool = ctx.perStar([320, 575, 1050]) * ctx.scaleOf('physical')
			ctx.castFx(t.cpos, { aoe: 2, spell: 'damage' })
			for (const e of victims) ctx.damage(e, pool / victims.length, 'physical')
		},
	},
	// 伊泽瑞尔：闪烁远离目标+伤害+攻速；每第 4 次施放改放穿透震波（穿透递减）
	DA_18_Ezreal: {
		cast(ctx) {
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!t) return
			if (ctx.unit.castCount % 4 === 0) {
				ctx.castFx(t.cpos, { spell: 'damage' })
				let mult = 1
				for (const e of ctx.enemiesOnLine(ctx.unit.cpos, t.cpos)) {
					ctx.damage(e, ctx.perStar([480, 865, 1560]) * ctx.scaleOf('physical') * mult, 'physical')
					mult = Math.max(0.4, mult - 0.15)
				}
				return
			}
			blinkAway(ctx, t)
			ctx.castFx(t.cpos, { spell: 'damage' })
			ctx.damage(t, ctx.perStar(M) * ctx.scaleOf('physical'), 'physical')
			ctx.buff(ctx.unit, { attackSpeed: 0.4 * ctx.scaleOf('magic') }, 4)
		},
	},
	// 莉莉娅：回复生命，蝴蝶伤害附近敌人并昏睡（承伤超 15% 最大生命即醒）
	DA_18_Lillia: {
		cast(ctx) {
			ctx.heal(ctx.unit, ctx.perStar(HEAL) * ctx.scaleOf('magic'))
			ctx.castFx(ctx.unit.cpos, { aoe: 2, spell: 'damage' })
			for (const e of ctx.enemiesInRange(ctx.unit.cpos, 2).slice(0, 3)) {
				ctx.damage(e, ctx.perStar(M) * ctx.scaleOf('magic'), 'magic')
				ctx.applyStatus(e, {
					kind: 'sleep',
					value: 0,
					seconds: 2.5,
					hpBudget: e.stats.maxHp * 0.15,
				})
			}
		},
	},
	// 墨菲特：获得护盾；护盾被打破时释放黑暗能量波（每场一次）
	DA_18_Malphite: {
		cast(ctx) {
			ctx.shield(
				ctx.unit,
				ctx.perStar(SHIELD) * ctx.scaleOf('magic') +
					(ctx.unit.stats.armor + ctx.unit.stats.magicResist) * 2,
			)
			ctx.unit.mem.shielded = 1
			ctx.castFx(ctx.unit.cpos, { spell: 'shield' })
		},
		onDamaged(ctx) {
			if (!ctx.unit.mem.shielded || ctx.unit.shield > 0) return
			ctx.unit.mem.shielded = 0
			ctx.castFx(ctx.unit.cpos, { aoe: 1, spell: 'damage' })
			for (const e of ctx.enemiesInRange(ctx.unit.cpos, 1)) {
				ctx.damage(e, ctx.perStar(M) * ctx.scaleOf('magic'), 'magic')
			}
		},
	},
	// 莫甘娜：被动全能吸血；主动诅咒附近敌人（伤害+减速+枯萎 DoT）
	DA_18_Morgana: {
		onCombatStart(ctx) {
			ctx.unit.stats.omnivamp += 0.2
		},
		cast(ctx) {
			const targets = ctx
				.enemiesInRange(ctx.unit.cpos, 3)
				.sort((a, b) => hexDistance(a.cpos, ctx.unit.cpos) - hexDistance(b.cpos, ctx.unit.cpos))
				.slice(0, 3)
			ctx.castFx(ctx.unit.cpos, { aoe: 2, spell: 'damage' })
			for (const e of targets) {
				ctx.damage(e, ctx.perStar(M) * ctx.scaleOf('magic'), 'magic')
				ctx.applyStatus(e, { kind: 'slow', value: 0.3, seconds: 4 })
				ctx.applyStatus(e, {
					kind: 'bleed',
					value: ctx.perStar([90, 160, 290]) * ctx.scaleOf('magic'),
					seconds: 4,
				})
			}
		},
	},
	// 瑟提：被动首次跌破 50% 生命充满法力；主动回复生命并轰击周围
	DA_18_Sett: {
		cast(ctx) {
			ctx.heal(ctx.unit, ctx.perStar(HEAL) * ctx.scaleOf('magic') + ctx.unit.stats.maxHp * 0.08)
			ctx.castFx(ctx.unit.cpos, { aoe: 2, spell: 'damage' })
			for (const e of ctx.enemiesInRange(ctx.unit.cpos, 2)) {
				ctx.damage(
					e,
					ctx.perStar(M) * ctx.scaleOf('physical') + ctx.unit.stats.maxHp * 0.1,
					'physical',
				)
			}
		},
		onDamaged(ctx) {
			if (ctx.unit.mem.passiveFired || ctx.unit.hp >= ctx.unit.stats.maxHp * 0.5) return
			ctx.unit.mem.passiveFired = 1
			ctx.unit.mana = Math.min(ctx.unit.stats.mana, ctx.unit.mana + 100)
			ctx.fx({ type: 'status', uid: ctx.unit.uid, statusKind: 'manaReave' })
		},
	},
	// 希维尔：十字刃伤害目标后向最近的其他敌人弹跳 2 次，击杀额外弹跳
	DA_18_Sivir: {
		cast(ctx) {
			let cur: PluginUnit | null = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!cur) return
			const hit = new Set<string>()
			let bounces = 2
			let dmg = ctx.perStar(M) * ctx.scaleOf('physical')
			ctx.castFx(cur.cpos, { spell: 'damage' })
			while (cur) {
				ctx.damage(cur, dmg, 'physical')
				hit.add(cur.uid)
				if (!cur.alive) bounces += 2
				if (bounces <= 0) break
				bounces -= 1
				const from: HexPos = cur.cpos
				cur =
					ctx
						.enemies()
						.filter((e) => !hit.has(e.uid))
						.sort((a, b) => hexDistance(a.cpos, from) - hexDistance(b.cpos, from))[0] ?? null
				dmg = ctx.perStar([240, 430, 780]) * ctx.scaleOf('physical')
			}
		},
	},
	// 索拉卡：星星砸目标；同一目标再次被砸追加 2 颗星星
	DA_18_Soraka: {
		cast(ctx) {
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!t) return
			const h = uidHash(t.uid)
			ctx.castFx(t.cpos, { spell: 'damage' })
			ctx.damage(t, ctx.perStar(M) * ctx.scaleOf('magic'), 'magic')
			if (ctx.unit.mem.lastStarTgt === h) {
				for (let i = 0; i < 2; i++) {
					ctx.damage(t, ctx.perStar([190, 345, 625]) * ctx.scaleOf('magic'), 'magic')
				}
			}
			ctx.unit.mem.lastStarTgt = h
		},
	},
	// 婕拉：在战场周围召唤 2 株荆棘喷射者
	DA_18_Zyra: {
		cast(ctx) {
			ctx.fx({ type: 'summon', uid: ctx.unit.uid })
			for (let i = 0; i < 2; i++) {
				ctx.summon('DA_Summon_ZyraPlant', {
					near: ctx.unit.cpos,
					hp: Math.round(ctx.perStar([500, 900, 1600])),
					ad: Math.round(ctx.perStar([120, 215, 390])),
				})
			}
		},
	},
	// 阿木木：被动每秒自疗+灼痛周围敌人；主动 2 格伤害+晕眩，灼烧中目标延长至 2.5s
	DA_Amumu18: {
		onTick(ctx) {
			ctx.unit.mem.auraAcc = (ctx.unit.mem.auraAcc ?? 0) + 0.1
			if ((ctx.unit.mem.auraAcc ?? 0) < 1) return
			ctx.unit.mem.auraAcc = 0
			ctx.heal(ctx.unit, ctx.unit.stats.maxHp * 0.015)
			for (const e of ctx.enemiesInRange(ctx.unit.cpos, 1)) {
				ctx.damage(e, ctx.perStar([35, 63, 115]) * ctx.scaleOf('magic'), 'magic', {
					canCrit: false,
				})
			}
		},
		cast(ctx) {
			ctx.castFx(ctx.unit.cpos, { aoe: 2, spell: 'damage' })
			for (const e of ctx.enemiesInRange(ctx.unit.cpos, 2)) {
				ctx.damage(e, ctx.perStar(M) * ctx.scaleOf('magic'), 'magic')
				ctx.applyStatus(e, {
					kind: 'stun',
					value: 0,
					seconds: ctx.isBurning(e) ? 2.5 : 1.5,
				})
			}
		},
	},
	// 绯红印记树怪：onKill 跃至下一目标并附加伤害；主动狂暴（攻速/攻击+无视护甲）；红霸符灼烧+自疗
	DA_Brambleback18: {
		cast(ctx) {
			ctx.unit.mem.pierce = 5
			ctx.buff(ctx.unit, { attackSpeed: 0.5, attackDamage: ctx.perStar([60, 110, 200]) }, 5)
			ctx.castFx(ctx.unit.cpos, { spell: 'buff' })
		},
		onKill(ctx) {
			const nxt = ctx.nearestEnemy()
			if (!nxt || !ctx.dashTo(ctx.unit, nxt)) return
			ctx.castFx(nxt.cpos, { spell: 'damage' })
			ctx.damage(nxt, ctx.perStar([320, 575, 1050]) * ctx.scaleOf('physical'), 'physical')
		},
		modifyAttack(ctx, target, raw) {
			if ((ctx.unit.mem.pierce ?? 0) <= 0) return raw
			ctx.unit.mem.pierce -= 1
			// 无视护甲近似：把 raw 放大到等价于护甲为 0 的税前值
			return (raw * (100 + target.stats.armor)) / 100
		},
		onDealDamage(ctx, dst) {
			if (!ctx.unit.alphaMark) return
			ctx.burn(dst, dst.stats.maxHp * 0.02, 3)
			ctx.heal(ctx.unit, ctx.unit.stats.maxHp * 0.03)
		},
	},
	// 奈德丽：按 AD/AP 较高者走分支——AP：下 3 次攻击替换为标枪（第 3 次瞄准最远敌人）；AD：变形挥击周围
	DA_Nidalee18_AP: {
		cast(ctx) {
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!t) return
			if (ctx.unit.stats.abilityPower >= ctx.unit.stats.attackDamage) {
				ctx.unit.mem.javelins = 3
				ctx.buff(ctx.unit, { attackSpeed: 0.5 }, 4)
				ctx.castFx(ctx.unit.cpos, { spell: 'buff' })
			} else {
				ctx.castFx(t.cpos, { aoe: 1, spell: 'damage' })
				for (const e of ctx.enemiesInRange(t.cpos, 1)) {
					ctx.damage(e, ctx.perStar(M) * ctx.scaleOf('physical'), 'physical')
				}
			}
		},
		onAttack(ctx, target) {
			if ((ctx.unit.mem.javelins ?? 0) <= 0) return
			ctx.unit.mem.javelins -= 1
			const third = (ctx.unit.mem.javelins ?? 0) === 0
			const tgt = third
				? (ctx
						.enemies()
						.sort(
							(a, b) => hexDistance(b.cpos, ctx.unit.cpos) - hexDistance(a.cpos, ctx.unit.cpos),
						)[0] ?? target)
				: target
			ctx.castFx(tgt.cpos, { spell: 'damage' })
			const mult = third ? 1.6 : 1
			ctx.damage(tgt, ctx.perStar([260, 470, 850]) * ctx.scaleOf('magic') * mult, 'magic')
		},
	},
	// 苍蓝雕纹魔像：护盾+向敌群最密方向裂隙（击飞+破法 6s）；蓝霸符施放时全队 +12 蓝
	DA_Sentinel18: {
		cast(ctx) {
			ctx.shield(ctx.unit, ctx.perStar(SHIELD) * ctx.scaleOf('magic') + ctx.unit.stats.maxHp * 0.12)
			if (ctx.unit.alphaMark) {
				for (const a of ctx.allies()) {
					if (a.uid === ctx.unit.uid) continue
					a.mana = Math.min(a.stats.mana, a.mana + 12)
				}
			}
			const t = ctx.bestLineTarget() ?? ctx.nearestEnemy()
			if (!t) return
			ctx.castFx(t.cpos, { aoe: 1, spell: 'damage' })
			for (const e of ctx.enemiesOnLine(ctx.unit.cpos, t.cpos)) {
				ctx.damage(e, ctx.perStar(M) * ctx.scaleOf('magic'), 'magic')
				ctx.applyStatus(e, { kind: 'stun', value: 0, seconds: 1 })
				ctx.applyStatus(e, { kind: 'manaReave', value: 0, seconds: 6 })
			}
		},
	},
}
