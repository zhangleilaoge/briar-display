import { hexDistance } from '../../hex'
import type { HexPos } from '../../types'
import type { AbilityCtx, AbilityPlugin, PluginUnit } from '../types'

/** 5 费技能数值基准（官方数值 CD 未收录，按费用/星级梯度手调） */
const M: [number, number, number] = [550, 990, 1800]

const uidHash = (s: string) => {
	let h = 0
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
	return Math.abs(h)
}

const encodeHex = (p: HexPos) => p.row * 10 + p.col
const decodeHex = (v: number): HexPos => ({ col: v % 10, row: Math.floor(v / 10) })

/** densestEnemyHex 返回格子而 dashTo 需要单位锚点：取该格最近的敌人 */
const densestEnemy = (ctx: AbilityCtx): PluginUnit | null => {
	const hex = ctx.densestEnemyHex()
	if (!hex) return ctx.nearestEnemy()
	return (
		ctx.enemies().sort((a, b) => hexDistance(a.cpos, hex) - hexDistance(b.cpos, hex))[0] ?? null
	)
}

/** 拉克丝形态加成钩子 */
interface LuxForm {
	/** 首个命中目标伤害倍率（灵魂莲华） */
	firstMult?: number
	/** 激光基础伤害前置倍率（日蚀骑士） */
	preMult?: (ctx: AbilityCtx) => number
	/** 每个命中目标的附加效果（黑荆棘/魔女/月蚀骑士） */
	onHit?: (ctx: AbilityCtx, e: PluginUnit) => void
	/** 施放后效果（永恒之森/花仙子/野兽之灵） */
	after?: (ctx: AbilityCtx, hit: PluginUnit[], dealt: number) => void
}

const luxCast = (form: LuxForm) => (ctx: AbilityCtx) => {
	// 被动：施放时与拉克丝同羁绊的友军回蓝（同羁绊判定简化为全体友军 +20 蓝）
	for (const a of ctx.allies()) a.mana = Math.min(a.stats.mana, a.mana + 20)
	const t = ctx.bestLineTarget() ?? ctx.nearestEnemy()
	if (!t) return
	ctx.castFx(t.cpos, { spell: 'damage' })
	const base = ctx.perStar(M) * ctx.scaleOf('magic') * (form.preMult?.(ctx) ?? 1)
	const hit = ctx.enemiesOnLine(ctx.unit.cpos, t.cpos)
	let mult = 1
	let dealt = 0
	let i = 0
	for (const e of hit) {
		dealt += ctx.damage(e, base * mult * (i === 0 ? (form.firstMult ?? 1) : 1), 'magic')
		form.onHit?.(ctx, e)
		mult = Math.max(0.4, mult - 0.15)
		i += 1
	}
	form.after?.(ctx, hit, dealt)
}

const lux = (form: LuxForm = {}, extra: AbilityPlugin = {}): AbilityPlugin => ({
	cast: luxCast(form),
	...extra,
})

/** 纳尔变形：跳向敌群 + 2 格物理伤害/削抗/晕眩，maxHp +40% 并补等额生命 */
const gnarTransform = (ctx: AbilityCtx) => {
	if (ctx.unit.mem.mega) return
	ctx.unit.mem.mega = 1
	ctx.unit.mem.rage = 100
	const anchor = densestEnemy(ctx)
	if (anchor) ctx.dashTo(ctx.unit, anchor)
	ctx.castFx(ctx.unit.cpos, { aoe: 2, spell: 'damage' })
	for (const e of ctx.enemiesInRange(ctx.unit.cpos, 2)) {
		ctx.damage(e, ctx.perStar(M) * ctx.scaleOf('physical'), 'physical')
		ctx.shred(e, 6)
		ctx.applyStatus(e, { kind: 'stun', value: 0, seconds: 1.5 })
	}
	const bonus = Math.round(ctx.unit.stats.maxHp * 0.4)
	ctx.unit.stats.maxHp += bonus
	ctx.heal(ctx.unit, bonus)
}

/** 塔里克绑定友军（uidHash 存 mem，mem 只收数字） */
const taricBound = (ctx: AbilityCtx): PluginUnit | null => {
	const h = ctx.unit.mem.bindHash
	if (h === undefined) return null
	return ctx.allies().find((a) => a.uid !== ctx.unit.uid && uidHash(a.uid) === h) ?? null
}

/** 塔里克被动：自己或绑定友军首次跌破 40% 血，2 格内友军获得各自 30% maxHp 护盾（每场一次） */
const taricProc = (ctx: AbilityCtx, who: PluginUnit) => {
	if (ctx.unit.mem.proc || who.hp >= who.stats.maxHp * 0.4) return
	ctx.unit.mem.proc = 1
	for (const a of ctx.alliesInRange(ctx.unit.cpos, 2)) ctx.shield(a, a.stats.maxHp * 0.3)
	ctx.castFx(ctx.unit.cpos, { aoe: 2, spell: 'shield' })
}

/** 茂凯树苗：跳向目标造成茂凯 maxHp 4% 魔法伤害（纯表现，非召唤物） */
const sapling = (ctx: AbilityCtx, target: PluginUnit) => {
	ctx.fx({ type: 'summon', uid: ctx.unit.uid, target: target.uid })
	ctx.damage(target, ctx.unit.stats.maxHp * 0.04, 'magic', { canCrit: false })
}

export const COST5_ABILITIES: Record<string, AbilityPlugin> = {
	// 拉露恩：2 个最近敌人各降 3 枚月光碎片，第 3 次施放改为满月（全体敌人分摊）并重置计数
	DA_18_Alune: {
		cast(ctx) {
			if ((ctx.unit.mem.moon ?? 0) >= 2) {
				ctx.unit.mem.moon = 0
				const es = ctx.enemies()
				if (es.length === 0) return
				ctx.castFx(ctx.unit.cpos, { aoe: 99, spell: 'damage' })
				const pool = ctx.perStar([900, 1600, 3000]) * ctx.scaleOf('magic')
				for (const e of es) ctx.damage(e, pool / es.length, 'magic')
				return
			}
			ctx.unit.mem.moon = (ctx.unit.mem.moon ?? 0) + 1
			const shard = ctx.perStar([120, 215, 400]) * ctx.scaleOf('magic')
			const near = ctx
				.enemies()
				.sort((a, b) => hexDistance(a.cpos, ctx.unit.cpos) - hexDistance(b.cpos, ctx.unit.cpos))
				.slice(0, 2)
			for (const e of near) {
				ctx.castFx(e.cpos, { spell: 'damage' })
				for (let i = 0; i < 3; i++) ctx.damage(e, shard, 'magic')
			}
		},
	},
	// 艾希：敌人最多直线箭矢物理伤害（穿透递减），留下 4 秒裂隙持续伤害+缓速
	DA_18_Ashe: {
		cast(ctx) {
			const t = ctx.bestLineTarget() ?? ctx.nearestEnemy()
			if (!t) return
			ctx.castFx(t.cpos, { spell: 'damage' })
			let mult = 1
			for (const e of ctx.enemiesOnLine(ctx.unit.cpos, t.cpos)) {
				ctx.damage(e, ctx.perStar([500, 900, 1650]) * ctx.scaleOf('physical') * mult, 'physical')
				mult = Math.max(0.5, mult - 0.1)
			}
			ctx.unit.mem.riftFrom = encodeHex(ctx.unit.cpos)
			ctx.unit.mem.riftTo = encodeHex(t.cpos)
			ctx.unit.mem.riftUntil = ctx.t + 4
			ctx.unit.mem.riftAcc = 0
		},
		onTick(ctx) {
			if (ctx.t >= (ctx.unit.mem.riftUntil ?? 0)) return
			ctx.unit.mem.riftAcc = (ctx.unit.mem.riftAcc ?? 0) + 0.1
			if ((ctx.unit.mem.riftAcc ?? 0) < 0.5) return
			ctx.unit.mem.riftAcc = 0
			const from = decodeHex(ctx.unit.mem.riftFrom ?? 0)
			const to = decodeHex(ctx.unit.mem.riftTo ?? 0)
			for (const e of ctx.enemiesOnLine(from, to)) {
				ctx.damage(e, e.stats.maxHp * 0.02, 'physical', { canCrit: false })
				ctx.applyStatus(e, { kind: 'slow', value: 0.3, seconds: 1 })
			}
		},
	},
	// 远古巨龙：被动普攻对目标邻格敌人溅射 50% AD 魔法伤害；首施起飞（不可选取+免控）+全体晕眩+引燃+全能吸血，并替换为烈焰吐息（直线贯穿+引燃）；自带低血处决
	DA_18_ElderDragon: {
		onCombatStart(ctx) {
			ctx.unit.mem.executeThreshold = 0.15
		},
		onAttack(ctx, target) {
			for (const e of ctx.enemiesInRange(target.cpos, 1)) {
				if (e.uid === target.uid) continue
				ctx.damage(e, ctx.unit.stats.attackDamage * 0.5, 'magic', { canCrit: false })
			}
		},
		cast(ctx) {
			if (!ctx.unit.mem.elder) {
				ctx.unit.mem.elder = 1
				ctx.applyStatus(ctx.unit, { kind: 'untargetable', value: 0, seconds: 1.5 })
				ctx.applyStatus(ctx.unit, { kind: 'ccImmune', value: 0, seconds: 1.5 })
				ctx.buff(ctx.unit, { omnivamp: 0.25 }, 30)
				for (const e of ctx.enemies()) {
					ctx.applyStatus(e, { kind: 'stun', value: 0, seconds: 1.5 })
					ctx.burn(e, e.stats.maxHp * 0.02, 8)
				}
				ctx.castFx(ctx.unit.cpos, { aoe: 99, spell: 'buff' })
			}
			// 烈焰吐息：敌人最多直线贯穿物理伤害（穿透递减）+ 引燃
			const t = ctx.bestLineTarget() ?? ctx.nearestEnemy()
			if (!t) return
			ctx.castFx(t.cpos, { spell: 'damage' })
			let mult = 1
			for (const e of ctx.enemiesOnLine(ctx.unit.cpos, t.cpos)) {
				ctx.damage(e, ctx.perStar([700, 1260, 2300]) * ctx.scaleOf('physical') * mult, 'physical')
				ctx.burn(e, e.stats.maxHp * 0.02, 8)
				mult = Math.max(0.3, mult - 0.15)
			}
		},
	},
	// 纳尔：怒气每秒+2/每攻+4，满 100（或施放）变形——跳向敌群 2 格物理伤害+削抗+晕眩、maxHp +40%；变形后施放改为抓投（主目标伤害+投向最远敌人连线路径次级伤害）
	DA_18_GnarSmall: {
		onTick(ctx) {
			if (ctx.unit.mem.mega) return
			ctx.unit.mem.rage = Math.min(100, (ctx.unit.mem.rage ?? 0) + 0.2)
			if ((ctx.unit.mem.rage ?? 0) >= 100) gnarTransform(ctx)
		},
		onAttack(ctx) {
			if (ctx.unit.mem.mega) return
			ctx.unit.mem.rage = Math.min(100, (ctx.unit.mem.rage ?? 0) + 4)
			if ((ctx.unit.mem.rage ?? 0) >= 100) gnarTransform(ctx)
		},
		cast(ctx) {
			if (!ctx.unit.mem.mega) {
				gnarTransform(ctx)
				return
			}
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!t) return
			ctx.castFx(t.cpos, { spell: 'damage' })
			ctx.damage(t, ctx.perStar(M) * ctx.scaleOf('physical'), 'physical')
			const far = ctx
				.enemies()
				.sort((a, b) => hexDistance(b.cpos, ctx.unit.cpos) - hexDistance(a.cpos, ctx.unit.cpos))[0]
			if (!far || far.uid === t.uid) return
			for (const e of ctx.enemiesOnLine(t.cpos, far.cpos)) {
				if (e.uid === t.uid) continue
				ctx.damage(e, ctx.perStar([275, 495, 900]) * ctx.scaleOf('physical'), 'physical')
			}
		},
	},
	// 艾翁：为最残 2 名友军套盾+伤害增幅，随后其邻格敌人受魔法伤害；第 3 次起施放额外给目标可叠攻速
	DA_18_Ivern: {
		cast(ctx) {
			const targets = ctx
				.allies()
				.sort((a, b) => a.hp / a.stats.maxHp - b.hp / b.stats.maxHp)
				.slice(0, 2)
			const shield = ctx.perStar([300, 540, 1000]) * ctx.scaleOf('magic')
			for (const a of targets) {
				ctx.shield(a, shield)
				ctx.buff(a, { damageAmp: 0.15 }, 6)
				if (ctx.unit.castCount >= 3) ctx.buff(a, { attackSpeed: 0.25 }, 6)
			}
			for (const a of targets) {
				for (const e of ctx.enemiesInRange(a.cpos, 1)) {
					ctx.damage(e, ctx.perStar([330, 595, 1080]) * ctx.scaleOf('magic'), 'magic')
				}
			}
			ctx.castFx(ctx.unit.cpos, { spell: 'shield' })
		},
	},
	// 凯南：蓄力按灼烧敌人数量加法强，获得护盾并冲刺穿过敌群，落点 2 格火焰风暴 3 秒 3 波均摊魔法伤害
	DA_18_Kennen: {
		cast(ctx) {
			const burning = ctx.enemies().filter((e) => ctx.isBurning(e)).length
			if (burning > 0)
				ctx.buff(ctx.unit, { abilityPower: ctx.unit.stats.abilityPower * 0.1 * burning }, 8)
			ctx.shield(ctx.unit, ctx.perStar([350, 630, 1150]) * ctx.scaleOf('magic'))
			const anchor = densestEnemy(ctx)
			if (anchor) ctx.dashTo(ctx.unit, anchor)
			ctx.unit.mem.stormC = encodeHex(ctx.unit.cpos)
			ctx.unit.mem.stormLeft = 3
			ctx.unit.mem.stormAcc = 0
			ctx.unit.mem.stormPool = ctx.perStar([600, 1080, 2000]) * ctx.scaleOf('magic')
			ctx.castFx(ctx.unit.cpos, { aoe: 2, spell: 'damage' })
		},
		onTick(ctx) {
			if ((ctx.unit.mem.stormLeft ?? 0) <= 0) return
			ctx.unit.mem.stormAcc = (ctx.unit.mem.stormAcc ?? 0) + 0.1
			if ((ctx.unit.mem.stormAcc ?? 0) < 1) return
			ctx.unit.mem.stormAcc = 0
			ctx.unit.mem.stormLeft -= 1
			const victims = ctx.enemiesInRange(decodeHex(ctx.unit.mem.stormC ?? 0), 2)
			if (victims.length === 0) return
			const per = (ctx.unit.mem.stormPool ?? 0) / 3 / victims.length
			for (const e of victims) ctx.damage(e, per, 'magic', { canCrit: false })
		},
	},
	// 茂凯：被动每累计承伤 800 一株树苗跳向附近随机敌人（阵亡跳 3 株）；主动目标 maxHp 比例魔法伤害+自疗（基准+已损失 20%）
	DA_18_Maokai: {
		onDamaged(ctx, amount) {
			ctx.unit.mem.mitigated = (ctx.unit.mem.mitigated ?? 0) + amount
			while ((ctx.unit.mem.mitigated ?? 0) >= 800) {
				ctx.unit.mem.mitigated -= 800
				const pool = ctx.enemiesInRange(ctx.unit.cpos, 2)
				const candidates = pool.length > 0 ? pool : ctx.enemies()
				const t = candidates[Math.floor(ctx.rng.next() * candidates.length)]
				if (t) sapling(ctx, t)
			}
		},
		onDeath(ctx) {
			const es = ctx.enemies()
			for (let i = 0; i < 3; i++) {
				const t = es[Math.floor(ctx.rng.next() * es.length)]
				if (t) sapling(ctx, t)
			}
		},
		cast(ctx) {
			ctx.heal(
				ctx.unit,
				ctx.perStar([250, 450, 850]) * ctx.scaleOf('magic') +
					(ctx.unit.stats.maxHp - ctx.unit.hp) * 0.2,
			)
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!t) return
			ctx.castFx(t.cpos, { spell: 'damage' })
			ctx.damage(
				t,
				ctx.perStar([500, 900, 1650]) * ctx.scaleOf('magic') + t.stats.maxHp * 0.12,
				'magic',
			)
		},
	},
	// 德莱文：被动攻击叠流血（每层 AD 15% dps/4s），25% 概率该次攻击 +60% 伤害并叠 2 层；主动对流血最多敌人及连线敌人投斧，消耗主目标流血立即结算剩余伤害，返程再造成 50%
	DA_Draven18: {
		modifyAttack(ctx, target, raw) {
			if (ctx.rng.next() >= 0.25) return raw
			ctx.unit.mem.spin = 1
			ctx.fx({
				type: 'attack',
				uid: ctx.unit.uid,
				target: target.uid,
				value: Math.round(raw * 0.6),
			})
			return raw * 1.6
		},
		onAttack(ctx, target) {
			const dps = ctx.unit.stats.attackDamage * 0.15
			const stacks = ctx.unit.mem.spin ? 2 : 1
			ctx.unit.mem.spin = 0
			for (let i = 0; i < stacks; i++) {
				ctx.applyStatus(target, { kind: 'bleed', value: dps, seconds: 4 })
			}
		},
		cast(ctx) {
			const liveBleeds = (u: PluginUnit) =>
				u.statuses.filter((s) => s.kind === 'bleed' && s.until > ctx.t)
			const t = ctx.enemies().sort((a, b) => liveBleeds(b).length - liveBleeds(a).length)[0] ?? null
			if (!t) return
			const hit = ctx.enemiesOnLine(ctx.unit.cpos, t.cpos)
			const dmg = ctx.perStar([450, 810, 1500]) * ctx.scaleOf('physical')
			ctx.castFx(t.cpos, { spell: 'damage' })
			for (const e of hit) ctx.damage(e, dmg, 'physical')
			// 消耗主目标流血：剩余秒数 × dps 立即结算后清除
			for (const s of liveBleeds(t)) {
				ctx.damage(t, s.value * Math.max(0, s.until - ctx.t), 'physical', { canCrit: false })
			}
			t.statuses = t.statuses.filter((s) => s.kind !== 'bleed')
			for (const e of hit) {
				if (e.alive) ctx.damage(e, dmg * 0.5, 'physical')
			}
		},
	},
	// 塔里克：开战绑定最近友军；自己或绑定友军首次跌破 40% 血时 2 格内友军各获 30% maxHp 护盾（每场一次）；主动自疗并强化下 2 次攻击附加魔法伤害（绑定友军的强化因 hook 按单位触发只作用于塔里克自身）
	DA_Taric18: {
		onCombatStart(ctx) {
			const b = ctx
				.allies()
				.filter((a) => a.uid !== ctx.unit.uid)
				.sort(
					(a, b2) => hexDistance(a.cpos, ctx.unit.cpos) - hexDistance(b2.cpos, ctx.unit.cpos),
				)[0]
			if (b) ctx.unit.mem.bindHash = uidHash(b.uid)
		},
		onDamaged(ctx) {
			taricProc(ctx, ctx.unit)
		},
		onAllyDamaged(ctx, ally) {
			const b = taricBound(ctx)
			if (b && ally.uid === b.uid) taricProc(ctx, ally)
		},
		cast(ctx) {
			ctx.heal(ctx.unit, ctx.perStar([300, 540, 1000]) * ctx.scaleOf('magic'))
			ctx.unit.mem.empower = 2
		},
		onAttack(ctx, target) {
			if ((ctx.unit.mem.empower ?? 0) <= 0) return
			ctx.unit.mem.empower -= 1
			ctx.damage(target, ctx.perStar([250, 450, 820]) * ctx.scaleOf('magic'), 'magic', {
				canCrit: false,
			})
		},
	},
	// 拉克丝：向敌人最多的直线发射激光（穿透递减 15% 最低 40%），施放时全体友军 +20 蓝
	DA_Lux18_Base: lux(),
	// 拉克丝（黑荆棘）：命中目标晕眩 1.5 秒
	DA_Lux18_Blackthorn: lux({
		onHit: (ctx, e) => {
			ctx.applyStatus(e, { kind: 'stun', value: 0, seconds: 1.5 })
		},
	}),
	// 拉克丝（灵魂莲华）：首个命中目标额外 +50% 伤害
	DA_Lux18_Blossom: lux({ firstMult: 1.5 }),
	// 拉克丝（魔女）：命中目标双抗削减持续至战斗结束（30 秒近似）
	DA_18_Lux_Coven: lux({
		onHit: (ctx, e) => ctx.shred(e, 30),
	}),
	// 拉克丝（永恒之森）：施放时全体友军 maxHp +10% 并治疗等额
	DA_18_Lux_Elderwood: lux({
		after(ctx) {
			// buff 不支持 maxHpPct：直接加面板并补等额生命（等于持续到战斗结束）
			for (const a of ctx.allies()) {
				const bonus = Math.round(a.stats.maxHp * 0.1)
				a.stats.maxHp += bonus
				ctx.heal(a, bonus)
			}
		},
	}),
	// 拉克丝（花仙子）：治疗生命比例最低友军，数额为本次激光总伤害的 40%
	DA_18_Lux_Fae: lux({
		after(ctx, _hit, dealt) {
			const low = ctx.allies().sort((a, b) => a.hp / a.stats.maxHp - b.hp / b.stats.maxHp)[0]
			if (low) ctx.heal(low, dealt * 0.4)
		},
	}),
	// 拉克丝（地狱火）：每次参与击杀回复 30 蓝
	DA_18_Lux_Inferno: lux(
		{},
		{
			onKill(ctx) {
				ctx.unit.mana = Math.min(ctx.unit.stats.mana, ctx.unit.mana + 30)
			},
		},
	),
	// 拉克丝（月蚀骑士）：命中目标附加 4 秒易损（以双抗削减近似增伤）
	DA_18_Lux_Moonbeam: lux({
		onHit: (ctx, e) => ctx.shred(e, 4),
	}),
	// 拉克丝（野兽之灵）：施放后自身攻速 +40% 持续 5 秒
	DA_18_Lux_Primal: lux({
		after(ctx) {
			ctx.buff(ctx.unit, { attackSpeed: 0.4 }, 5)
		},
	}),
	// 拉克丝（日蚀骑士）：每个不同的 3 星友军使本次伤害 +10%
	DA_18_Lux_Sunbeam: lux({
		preMult: (ctx) =>
			1 +
			0.1 *
				new Set(
					ctx
						.allies()
						.filter((a) => a.star === 3)
						.map((a) => a.apiName),
				).size,
	}),
}
