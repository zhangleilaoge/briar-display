import { MANA_PER_DAMAGE_TAKEN, MANA_TAKEN_CAP } from '../data/rules'
import { CHAMPION_BY_API } from '../data/set18'
import { MONSTER_BY_API, NO_ACT_UNITS } from '../data/set18/monsters'
import { type AbilitySpec, abilityScale } from './abilities'
import type { CombatEvent, CombatUnitInput } from './combat'
import { hexDistance, lineHexes, nearestFreeInRange } from './hex'
import { type ItemTag, itemEffectNum } from './items'
import { ABILITY_PLUGINS } from './plugins/abilities'
import type { AbilityCtx, PluginUnit, TraitCombatPlugin, TraitCtx } from './plugins/types'
import type { Rng } from './rng'
import { addStatus, applyCc, cleanse, getStatus } from './status'
import type { CombatStats, HexPos, StarLevel } from './types'

interface TimedBuff {
	mods: Partial<CombatStats>
	until: number
}

export interface CombatUnit extends CombatUnitInput {
	side: 'A' | 'B'
	cpos: HexPos
	hp: number
	shield: number
	mana: number
	target: string | null
	atkCd: number
	moveCd: number
	alive: boolean
	ability: AbilitySpec
	tags: ItemTag[]
	asStacks: number
	apTimer: number
	burnDps: number
	burnLeft: number
	/** 激发之匣施法 HoT：每秒回复量与剩余秒数 */
	hotRate: number
	hotLeft: number
	shredLeft: number
	lowhpShieldUsed: boolean
	damageDealt: number
	damageTaken: number
	summonsLeft: number
	statuses: import('./status').Status[]
	buffs: TimedBuff[]
	attackCount: number
	castCount: number
	mem: Record<string, number>
}

export type SpawnFn = (input: CombatUnitInput, side: 'A' | 'B') => CombatUnit

export type DealDamageFn = (
	src: CombatUnit,
	dst: CombatUnit,
	raw: number,
	type: 'physical' | 'magic' | 'true',
	canCrit: boolean,
	tNow: number,
) => number

export interface SummonOpts {
	hp?: number
	ad?: number
	star?: StarLevel
}

/** combat.ts 编排层注入的战场状态与核心原语，内部机制函数全部经它访问 */
export interface CombatDeps {
	units: CombatUnit[]
	byUid: Map<string, CombatUnit>
	rng: Rng
	overtimeAmp: () => number
	emit: (e: CombatEvent) => void
	isFree: (p: HexPos) => boolean
	rebuildOccupied: () => void
	recordDeath: (u: CombatUnit) => void
	nearestEnemy: (u: CombatUnit, enemies: CombatUnit[]) => CombatUnit | null
	dealDamage: DealDamageFn
	healUnit: (src: CombatUnit, dst: CombatUnit, amount: number, tNow: number) => void
	abilityCanCrit: (u: CombatUnit) => boolean
	spawnSummon: (owner: CombatUnit, apiName: string, spot: HexPos, o?: SummonOpts) => CombatUnit
	makeCtx: (u: CombatUnit) => AbilityCtx
	makeTraitCtx: (side: 'A' | 'B') => TraitCtx
	traitPluginsOf: (side: 'A' | 'B') => TraitCombatPlugin[]
	metric: (side: 'A' | 'B', key: string, delta: number) => void
}

export const emptyStats = (): CombatStats => ({
	maxHp: 0,
	attackDamage: 0,
	abilityPower: 0,
	attackSpeed: 0,
	armor: 0,
	magicResist: 0,
	mana: 0,
	initialMana: 0,
	range: 1,
	critChance: 0,
	critMultiplier: 1,
	manaRegen: 0,
	damageAmp: 0,
	damageReduction: 0,
	omnivamp: 0,
})

/** 召唤物生成：棋子/怪物数据回退 + 面板结算，spawnFn 由编排层提供 */
export function spawnSummon(
	spawnFn: SpawnFn,
	uid: string,
	owner: CombatUnit,
	apiName: string,
	spot: HexPos,
	o?: SummonOpts,
): CombatUnit {
	const champ = CHAMPION_BY_API.get(apiName)
	const mon = MONSTER_BY_API.get(apiName)
	const star = o?.star ?? 1
	const starMult = star === 3 ? 3.24 : star === 2 ? 1.8 : 1
	const baseHp = champ ? champ.stats.hp * starMult : (mon?.stats.maxHp ?? owner.stats.maxHp * 0.5)
	const baseAd = champ
		? champ.stats.damage * starMult
		: (mon?.stats.attackDamage ?? owner.stats.attackDamage * 0.4)
	const sstats: CombatStats = {
		...emptyStats(),
		maxHp: Math.round(o?.hp ?? baseHp),
		attackDamage: Math.round(o?.ad ?? baseAd),
		attackSpeed: champ?.stats.attackSpeed ?? mon?.stats.attackSpeed ?? 0.7,
		armor: champ?.stats.armor ?? mon?.stats.armor ?? 0,
		magicResist: champ?.stats.magicResist ?? mon?.stats.magicResist ?? 0,
		range: champ?.stats.range ?? mon?.stats.range ?? 1,
		mana: Number.POSITIVE_INFINITY,
	}
	const su = spawnFn(
		{
			uid,
			apiName,
			star,
			pos: { col: spot.col, row: spot.row },
			stats: sstats,
			items: [],
		},
		owner.side,
	)
	su.cpos = spot
	su.lowhpShieldUsed = true
	su.summonsLeft = 0
	if (NO_ACT_UNITS.has(apiName)) su.mem.noAct = 1
	return su
}

/** 技能插件上下文（AbilityCtx）工厂 */
export function makeAbilityCtx(deps: CombatDeps, u: CombatUnit, t: number): AbilityCtx {
	const { units, byUid, rng, emit } = deps
	const enemiesOf = () => units.filter((e) => e.alive && e.side !== u.side)
	const alliesOf = () => units.filter((e) => e.alive && e.side === u.side)
	let castFxDone = false
	const ctx: AbilityCtx = {
		t,
		rng,
		unit: u,
		enemies: enemiesOf,
		allies: alliesOf,
		currentTarget: () => (u.target ? (byUid.get(u.target) ?? null) : null),
		nearestEnemy: (_from?: PluginUnit) => deps.nearestEnemy(u, enemiesOf()),
		enemiesInRange: (center, radius) =>
			enemiesOf().filter((e) => hexDistance(e.cpos, center) <= radius),
		alliesInRange: (center, radius) =>
			alliesOf().filter((e) => hexDistance(e.cpos, center) <= radius),
		enemiesOnLine: (from, to) => {
			const line = lineHexes(from, to)
			return enemiesOf().filter((e) =>
				line.some((h) => h.col === e.cpos.col && h.row === e.cpos.row),
			)
		},
		densestEnemyHex: () => {
			let best: HexPos | null = null
			let bestN = 0
			for (const e of enemiesOf()) {
				const n = enemiesOf().filter((x) => hexDistance(x.cpos, e.cpos) <= 1).length
				if (n > bestN) {
					bestN = n
					best = e.cpos
				}
			}
			return best
		},
		bestLineTarget: () => {
			let best: CombatUnit | null = null
			let bestN = -1
			for (const e of enemiesOf()) {
				const n = ctx.enemiesOnLine(u.cpos, e.cpos).length
				if (n > bestN) {
					bestN = n
					best = e
				}
			}
			return best
		},
		damage: (dst, raw, type, o) =>
			deps.dealDamage(u, dst as CombatUnit, raw, type, o?.canCrit ?? deps.abilityCanCrit(u), t),
		heal: (dst, amount) => deps.healUnit(u, dst as CombatUnit, amount, t),
		shield: (dst, amount) => {
			const d = dst as CombatUnit
			d.shield += amount
			emit({ t, type: 'shield', uid: u.uid, target: d.uid, value: Math.round(amount) })
		},
		applyStatus: (dst, s) => {
			const d = dst as CombatUnit
			const ok = applyCc(d, { ...s, until: t + s.seconds }, t)
			if (ok) emit({ t, type: 'status', uid: u.uid, target: d.uid, statusKind: s.kind })
			return ok
		},
		cleanse: (x) => cleanse(x as CombatUnit),
		burn: (dst, dps, seconds) => {
			const d = dst as CombatUnit
			d.burnDps = Math.max(d.burnDps, dps)
			d.burnLeft = Math.max(d.burnLeft, seconds)
		},
		shred: (dst, seconds) => {
			;(dst as CombatUnit).shredLeft = Math.max((dst as CombatUnit).shredLeft, seconds)
		},
		isBurning: (x) => ((x as CombatUnit).burnLeft ?? 0) > 0,
		buff: (x, mods, seconds) => {
			const c = x as CombatUnit
			const flat: Partial<CombatStats> = { ...mods }
			for (const k of Object.keys(flat) as (keyof CombatStats)[]) {
				c.stats[k] += flat[k] ?? 0
			}
			c.buffs.push({ mods: flat, until: t + seconds })
		},
		dashTo: (x, target) => {
			const c = x as CombatUnit
			const d = target as CombatUnit
			const spot = nearestFreeInRange(d.cpos, 1, deps.isFree)
			if (!spot) return false
			c.cpos = spot
			deps.rebuildOccupied()
			emit({ t, type: 'move', uid: c.uid, pos: spot })
			return true
		},
		teleport: (x, pos) => {
			const c = x as CombatUnit
			if (!deps.isFree(pos)) return
			c.cpos = pos
			deps.rebuildOccupied()
			emit({ t, type: 'move', uid: c.uid, pos })
		},
		summon: (apiName, o) => {
			if (u.summonsLeft <= 0) return null
			const spot = nearestFreeInRange(o?.near ?? u.cpos, 2, deps.isFree)
			if (!spot) return null
			u.summonsLeft -= 1
			const su = deps.spawnSummon(u, apiName, spot, o)
			units.push(su)
			byUid.set(su.uid, su)
			deps.rebuildOccupied()
			emit({ t, type: 'summon', uid: u.uid, target: su.uid, pos: spot, value: su.stats.maxHp })
			return su
		},
		perStar: (values) => values[u.star - 1] ?? values[0],
		scaleOf: (type) =>
			type === 'physical' ? u.stats.attackDamage / 100 : u.stats.abilityPower / 100,
		castFx: (pos, o) => {
			castFxDone = true
			emit({ t, type: 'cast', uid: u.uid, pos, aoe: o?.aoe ?? 0, spell: o?.spell ?? 'damage' })
		},
		fx: (e) => emit({ ...e, t }),
		metric: (key, delta) => deps.metric(u.side, key, delta),
	}
	;(ctx as { __fxDone?: () => boolean }).__fxDone = () => castFxDone
	return ctx
}

/** 无专属插件时的通用原型技能（兼容旧行为） */
export function genericCast(deps: CombatDeps, u: CombatUnit, tNow: number): void {
	const { units, byUid, emit } = deps
	const spec = u.ability
	const scale = abilityScale(spec, u.stats)
	const value = spec.values[u.star - 1] * scale
	const enemies = units.filter((e) => e.alive && e.side !== u.side)
	const allies = units.filter((e) => e.alive && e.side === u.side)
	const target = (u.target ? byUid.get(u.target) : null) ?? null
	const canCrit = deps.abilityCanCrit(u)
	const isDamageSpell =
		spec.kind === 'strike' || spec.kind === 'aoe' || spec.kind === 'dot' || spec.kind === 'dash'
	const fxTarget = isDamageSpell
		? target?.alive
			? target
			: deps.nearestEnemy(u, enemies)
		: spec.kind === 'heal' || spec.kind === 'shield'
			? allies.sort((a, b) => a.hp / a.stats.maxHp - b.hp / b.stats.maxHp)[0]
			: null
	emit({
		t: tNow,
		type: 'cast',
		uid: u.uid,
		pos: fxTarget?.cpos ?? u.cpos,
		aoe: spec.kind === 'aoe' ? spec.aoeRange : 0,
		spell:
			spec.kind === 'heal'
				? 'heal'
				: spec.kind === 'shield'
					? 'shield'
					: isDamageSpell
						? 'damage'
						: 'buff',
	})

	switch (spec.kind) {
		case 'strike': {
			const dst = target?.alive ? target : deps.nearestEnemy(u, enemies)
			if (dst) deps.dealDamage(u, dst, value, spec.damageType, canCrit, tNow)
			break
		}
		case 'aoe': {
			const center = target?.alive ? target : deps.nearestEnemy(u, enemies)
			if (!center) break
			const victims =
				spec.aoeRange >= 99
					? enemies
					: enemies.filter((e) => hexDistance(e.cpos, center.cpos) <= spec.aoeRange)
			for (const v of victims) deps.dealDamage(u, v, value, spec.damageType, canCrit, tNow)
			break
		}
		case 'dot': {
			const dst = target?.alive ? target : deps.nearestEnemy(u, enemies)
			if (dst) {
				dst.burnDps = Math.max(dst.burnDps, value / spec.dotSeconds)
				dst.burnLeft = Math.max(dst.burnLeft, spec.dotSeconds)
			}
			break
		}
		case 'heal': {
			const lowest = allies.sort((a, b) => a.hp / a.stats.maxHp - b.hp / b.stats.maxHp)[0]
			if (lowest) deps.healUnit(u, lowest, value, tNow)
			break
		}
		case 'shield': {
			const lowest = allies.sort((a, b) => a.hp / a.stats.maxHp - b.hp / b.stats.maxHp)[0]
			if (lowest) {
				lowest.shield += value
				emit({
					t: tNow,
					type: 'shield',
					uid: u.uid,
					target: lowest.uid,
					value: Math.round(value),
				})
			}
			break
		}
		case 'buff':
		case 'transform': {
			u.stats.attackSpeed *= 1 + value / 200
			u.stats.attackDamage *= 1 + value / 300
			if (spec.kind === 'transform') deps.healUnit(u, u, u.stats.maxHp * 0.3, tNow)
			break
		}
		case 'dash': {
			const dst = target?.alive ? target : deps.nearestEnemy(u, enemies)
			if (!dst) break
			const spot = nearestFreeInRange(dst.cpos, 1, deps.isFree)
			if (spot) {
				u.cpos = spot
				deps.rebuildOccupied()
				emit({ t: tNow, type: 'move', uid: u.uid, pos: spot })
			}
			deps.dealDamage(u, dst, value, spec.damageType, canCrit, tNow)
			break
		}
		case 'summon': {
			for (let i = 0; i < spec.summonCount && u.summonsLeft > 0; i++) {
				const spot = nearestFreeInRange(u.cpos, 1, deps.isFree)
				if (!spot) break
				const su = deps.spawnSummon(u, 'TFT_Voidspawn', spot, {
					hp: Math.round(value * 3),
					ad: Math.round(value * 0.4),
				})
				units.push(su)
				byUid.set(su.uid, su)
				deps.rebuildOccupied()
				emit({
					t: tNow,
					type: 'summon',
					uid: u.uid,
					target: su.uid,
					pos: spot,
					value: su.stats.maxHp,
				})
			}
			break
		}
	}
}

/** 击杀时携带在伤害来源身上的神器钩子（卢登/护臂/火炮/暗爪） */
function afterKillArtifacts(
	deps: CombatDeps,
	src: CombatUnit,
	dst: CombatUnit,
	dmg: number,
	hpBefore: number,
	tNow: number,
): void {
	if (src.tags.includes('ludensBounce')) {
		// 卢登的激荡：过量伤害 +100 弹射至距目标最近的 2 个敌人
		const overkill = Math.max(0, dmg - hpBefore)
		const victims = deps.units
			.filter((e) => e.alive && e.side !== src.side && e.uid !== dst.uid)
			.sort((a, b) => hexDistance(a.cpos, dst.cpos) - hexDistance(b.cpos, dst.cpos))
			.slice(0, 2)
		for (const v of victims) deps.dealDamage(src, v, overkill + 100, 'magic', false, tNow)
	}
	if (src.tags.includes('takedownStack')) {
		// 探索者的护臂：参与击杀 +20 双抗与法强
		src.stats.armor += 20
		src.stats.magicResist += 20
		src.stats.abilityPower += 20
	}
	// 疾射火炮：每击杀 +1 攻击距离
	if (src.tags.includes('rangeOnKill')) src.stats.range += 1
	if (src.tags.includes('prowlDash')) {
		// 暗行者之爪：净化并冲刺 4 格内最远敌人，下 2 次暴击增伤
		cleanse(src)
		src.mem.prowlCrits = 2
		const far = deps.units
			.filter((e) => e.alive && e.side !== src.side && hexDistance(src.cpos, e.cpos) <= 4)
			.sort((a, b) => hexDistance(b.cpos, src.cpos) - hexDistance(a.cpos, src.cpos))[0]
		if (far) {
			const spot = nearestFreeInRange(far.cpos, 1, deps.isFree)
			if (spot) {
				src.cpos = spot
				deps.rebuildOccupied()
				deps.emit({ t: tNow, type: 'move', uid: src.uid, pos: spot })
			}
		}
	}
}

/** 伤害结算主流程：抗性/暴击/护盾/回蓝/吸血 + 阵亡与受击钩子分发 */
export function dealDamageImpl(
	deps: CombatDeps,
	src: CombatUnit,
	dst: CombatUnit,
	raw: number,
	type: 'physical' | 'magic' | 'true',
	canCrit: boolean,
	tNow: number,
): number {
	const { rng, emit } = deps
	if (!dst.alive) return 0
	let resist = type === 'physical' ? dst.stats.armor : type === 'magic' ? dst.stats.magicResist : 0
	if (dst.shredLeft > 0) resist *= 0.7
	let dmg = raw * (1 + src.stats.damageAmp + deps.overtimeAmp()) * (1 - dst.stats.damageReduction)
	if (type !== 'true') dmg *= 100 / (100 + Math.max(0, resist))
	if (src.tags.includes('giantSlayer') && dst.stats.maxHp > 1600) dmg *= 1.2
	let crit = false
	if (canCrit && rng.next() < src.stats.critChance) {
		dmg *= src.stats.critMultiplier
		crit = true
		// 暗行者之爪：击杀后的下 2 次暴击 +50% 暴击伤害
		if ((src.mem.prowlCrits ?? 0) > 0) {
			dmg *= 1.5
			src.mem.prowlCrits -= 1
		}
	}
	dmg = Math.max(1, Math.round(dmg))
	// 处决类机制由羁绊/技能插件标记 executeThreshold（值=生命阈值比例）
	const execThreshold = src.mem.executeThreshold ?? 0
	if (execThreshold > 0 && dst.hp > 0 && dst.hp < dst.stats.maxHp * execThreshold) {
		dmg = dst.hp + dst.shield
	}
	// 受伤回蓝 = 最终伤害 x 系数，单次封顶
	const manaGain = Math.min(dmg * MANA_PER_DAMAGE_TAKEN, MANA_TAKEN_CAP)
	dst.mana = Math.min(dst.stats.mana, dst.mana + manaGain)
	if (dst.shield > 0) {
		const absorbed = Math.min(dst.shield, dmg)
		dst.shield -= absorbed
		dmg -= absorbed
	}
	const hpBefore = dst.hp
	dst.hp -= dmg
	dst.damageTaken += dmg
	src.damageDealt += dmg
	if (src.stats.omnivamp > 0) src.hp = Math.min(src.stats.maxHp, src.hp + dmg * src.stats.omnivamp)
	emit({ t: tNow, type: 'damage', uid: src.uid, target: dst.uid, value: dmg, crit })

	// 昏睡承伤预算耗尽即醒来
	const sleep = getStatus(dst, 'sleep', tNow)
	if (sleep && sleep.hpBudget !== undefined) {
		sleep.hpBudget -= dmg
		if (sleep.hpBudget <= 0) sleep.until = 0
	}

	if (dst.hp <= 0) {
		dst.hp = 0
		dst.alive = false
		emit({ t: tNow, type: 'death', uid: dst.uid })
		deps.recordDeath(dst)
		deps.rebuildOccupied()
		ABILITY_PLUGINS.get(dst.apiName)?.onDeath?.(deps.makeCtx(dst))
		ABILITY_PLUGINS.get(src.apiName)?.onKill?.(deps.makeCtx(src), dst)
		for (const side of ['A', 'B'] as const) {
			for (const p of deps.traitPluginsOf(side)) {
				if (side === src.side) p.onKill?.(side, src, dst, deps.makeTraitCtx(side))
				if (side === dst.side) p.onDeath?.(side, dst, deps.makeTraitCtx(side))
			}
		}
		afterKillArtifacts(deps, src, dst, dmg, hpBefore, tNow)
	} else {
		// 低血护盾类装备：每场一次
		if (
			!dst.lowhpShieldUsed &&
			dst.tags.includes('lowhpShield') &&
			dst.hp < dst.stats.maxHp * 0.4
		) {
			dst.lowhpShieldUsed = true
			dst.shield += dst.stats.maxHp * 0.25
			emit({ t: tNow, type: 'shield', uid: dst.uid, value: Math.round(dst.stats.maxHp * 0.25) })
		}
		// 击中附伤类装备：灼烧+重伤 / 魔抗击碎
		if (src.tags.includes('burnOnHit')) {
			dst.burnDps = Math.max(dst.burnDps, dst.stats.maxHp * 0.01)
			dst.burnLeft = Math.max(dst.burnLeft, 3)
			addStatus(dst, { kind: 'wound', until: tNow + 3, value: 0.33 })
		}
		if (src.tags.includes('mrShredOnHit')) dst.shredLeft = 4
		// 激发之匣：每次被攻击命中回复总法力值的 PercentMana%（每件独立生效）
		if (dst.tags.includes('innervatingLocket') && Number.isFinite(dst.stats.mana)) {
			const pct = (itemEffectNum('TFT_Item_Artifact_InnervatingLocket', 'PercentMana') ?? 1) / 100
			const n = dst.items.filter((i) => i === 'TFT_Item_Artifact_InnervatingLocket').length || 1
			dst.mana = Math.min(dst.stats.mana, dst.mana + dst.stats.mana * pct * n)
		}
		// 插件钩子：伤害来源 / 受伤者 / 同阵营监听
		ABILITY_PLUGINS.get(src.apiName)?.onDealDamage?.(deps.makeCtx(src), dst, type, dmg)
		for (const p of deps.traitPluginsOf(src.side))
			p.onDealDamage?.(src.side, src, dst, type, dmg, deps.makeTraitCtx(src.side))
		ABILITY_PLUGINS.get(dst.apiName)?.onDamaged?.(deps.makeCtx(dst), dmg, src)
		for (const p of deps.traitPluginsOf(dst.side))
			p.onDamaged?.(dst.side, dst, dmg, deps.makeTraitCtx(dst.side))
		for (const a of deps.units) {
			if (!a.alive || a.side !== dst.side || a.uid === dst.uid) continue
			ABILITY_PLUGINS.get(a.apiName)?.onAllyDamaged?.(deps.makeCtx(a), dst, dmg)
		}
	}
	return dmg
}
