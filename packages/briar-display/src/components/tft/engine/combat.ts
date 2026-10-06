import {
	COMBAT_MAX_SECONDS,
	COMBAT_TICK_MS,
	MANA_PER_ATTACK,
	OVERTIME_AMP_PER_TICK,
} from '../data/rules'
import { TRAIT_BY_API } from '../data/set18'
import { NO_ACT_UNITS } from '../data/set18/monsters'
import { resolveAbility } from './abilities'
import {
	type CombatDeps,
	type CombatUnit,
	type DealDamageFn,
	type SummonOpts,
	dealDamageImpl,
	genericCast,
	makeAbilityCtx,
	spawnSummon,
} from './combatInternal'
import { hexDistance, nearestFreeInRange, stepToward, toCombatRow } from './hex'
import { type ItemTag, WITS_END_STAGE_DAMAGE, itemEffectNum, itemTags } from './items'
import { ABILITY_PLUGINS } from './plugins/abilities'
import { TRAIT_PLUGINS } from './plugins/traits'
import type { AbilityCtx, TraitCtx } from './plugins/types'
import type { Rng } from './rng'
import { applyCc, getStatus, hasStatus, healFactor, isDisabled, slowFactor } from './status'
import { TRAIT_EFFECTS } from './traitEffects'
import type { ActiveTrait } from './traits'
import type { CombatStats, HexPos, StarLevel } from './types'

export interface CombatUnitInput {
	uid: string
	apiName: string
	star: StarLevel
	/** 放置坐标（行 0..3，0=前排） */
	pos: HexPos
	/** unitStats + applyTraitStats 结算后的最终面板 */
	stats: CombatStats
	items: string[]
	/** 阿尔法印记：解锁该峡谷野怪的专属霸符 */
	alphaMark?: boolean
	/** 拉克丝选定的羁绊（大元素使 +2 计数已在 traits.ts 结算，这里供战斗插件判定成员身份） */
	chosenTrait?: string
	/** 羁绊效能放大（致命丽花等）：traitApi → 倍率，战斗插件按源单位读取 */
	traitAmp?: Record<string, number>
	/** 假人金币海克斯：[每存活 N 秒, 提供金币] */
	dummyGold?: [number, number]
	/** 替罪羊海克斯：该假人全队最先阵亡时提供的金币 */
	scapegoatGold?: number
	/** 碰撞测试假人海克斯：开战发射至敌群并晕眩的秒数 */
	crashTestStun?: number
	/** 海克斯注入的额外机制标签（正义报复=技能暴击等；装备标签之外的补充） */
	extraTags?: ItemTag[]
}

export interface CombatEvent {
	t: number
	type: 'move' | 'attack' | 'cast' | 'damage' | 'heal' | 'shield' | 'death' | 'summon' | 'status'
	uid: string
	target?: string
	value?: number
	pos?: HexPos
	crit?: boolean
	/** 施法特效：影响范围（0 单体 / 1 一圈 / 99 全体）与类型着色 */
	aoe?: number
	spell?: 'damage' | 'heal' | 'shield' | 'buff'
	/** status 事件的状态名（眩晕/昏睡/嘲讽…） */
	statusKind?: string
}

export interface CombatResult {
	winner: 'A' | 'B' | 'draw'
	survivorsA: number
	survivorsB: number
	durationMs: number
	events: CombatEvent[]
	damageDealt: Record<string, number>
	/** 每个 uid 承受的总伤害（奥恩锻炉能量等用） */
	damageTaken: Record<string, number>
	/** 跨战斗持久化指标（插件 metric() 上报，gameLoop 结算消费） */
	metricsA: Record<string, number>
	metricsB: Record<string, number>
}

interface CombatOptions {
	rng: Rng
	/** 双方已激活的羁绊（含档位），战斗内插件/标签都从这里派生 */
	traitsA?: ActiveTrait[]
	traitsB?: ActiveTrait[]
	recordEvents?: boolean
	maxSeconds?: number
	/** 当前阶段数：智慧末刃等随阶段成长的装备读取（默认 1） */
	stage?: number
}

const TICK_S = COMBAT_TICK_MS / 1000

/** 全队自动战斗模拟：100ms tick，防守方 A 在上半区，进攻方 B 镜像入下半区 */
export function simulateCombat(
	teamA: CombatUnitInput[],
	teamB: CombatUnitInput[],
	opts: CombatOptions,
): CombatResult {
	const { rng } = opts
	const record = opts.recordEvents !== false
	const maxSeconds = opts.maxSeconds ?? COMBAT_MAX_SECONDS
	const stage = opts.stage ?? 1
	const events: CombatEvent[] = []
	const metricsBy: Record<'A' | 'B', Record<string, number>> = { A: {}, B: {} }
	const units: CombatUnit[] = []
	let summonSeq = 0

	const spawn = (input: CombatUnitInput, side: 'A' | 'B'): CombatUnit => {
		const tags = [...input.items.flatMap(itemTags), ...(input.extraTags ?? [])]
		return {
			...input,
			side,
			cpos: {
				col: input.pos.col,
				row: toCombatRow(input.pos.row, side === 'A' ? 'defender' : 'attacker'),
			},
			hp: input.stats.maxHp,
			shield: 0,
			mana: Math.min(input.stats.initialMana, input.stats.mana),
			target: null,
			atkCd: 0.2,
			moveCd: 0,
			alive: true,
			ability: resolveAbility(input.apiName),
			tags,
			asStacks: 0,
			apTimer: 0,
			burnDps: 0,
			burnLeft: 0,
			hotRate: 0,
			hotLeft: 0,
			shredLeft: 0,
			lowhpShieldUsed: false,
			damageDealt: 0,
			damageTaken: 0,
			summonsLeft: 4,
			// 顽强不屈：永久晕眩免疫
			statuses: tags.includes('ccImmune')
				? [{ kind: 'ccImmune', until: Number.POSITIVE_INFINITY, value: 0 }]
				: [],
			buffs: [],
			attackCount: 0,
			castCount: 0,
			mem: NO_ACT_UNITS.has(input.apiName) ? { noAct: 1 } : {},
		}
	}
	for (const u of teamA) units.push(spawn(u, 'A'))
	for (const u of teamB) units.push(spawn(u, 'B'))

	const occupied = new Map<string, CombatUnit>()
	const keyOf = (p: HexPos) => `${p.col},${p.row}`
	const rebuildOccupied = () => {
		occupied.clear()
		for (const u of units) if (u.alive) occupied.set(keyOf(u.cpos), u)
	}
	rebuildOccupied()
	const isFree = (p: HexPos) => !occupied.has(keyOf(p))
	const byUid = new Map(units.map((u) => [u.uid, u]))

	/** 每方最先阵亡者的 apiName（替罪羊海克斯结算用） */
	const firstDeath: Record<'A' | 'B', string | null> = { A: null, B: null }
	const recordDeath = (u: CombatUnit) => {
		if (!firstDeath[u.side]) firstDeath[u.side] = u.apiName
	}

	const emit = (e: CombatEvent) => {
		if (record) events.push(e)
	}

	let overtimeAmp = 0
	let t = 0

	const nearestEnemy = (u: CombatUnit, enemies: CombatUnit[]): CombatUnit | null => {
		let best: CombatUnit | null = null
		let bestD = Number.POSITIVE_INFINITY
		for (const e of enemies) {
			if (hasStatus(e, 'untargetable', t)) continue
			const d = hexDistance(u.cpos, e.cpos)
			if (d < bestD || (d === bestD && best && e.hp < best.hp)) {
				best = e
				bestD = d
			}
		}
		return best
	}

	const traitsOf = (side: 'A' | 'B') => (side === 'A' ? opts.traitsA : opts.traitsB) ?? []
	/** 机制标签集（高档位继承低档机制），供 ability-crit 等快速判定 */
	const traitTagsOf = (side: 'A' | 'B'): Set<string> => {
		const tags = new Set<string>()
		for (const a of traitsOf(side)) {
			const defs = TRAIT_EFFECTS[a.apiName]
			for (let i = 0; i <= a.breakpointIndex; i++) {
				const tag = defs?.[i]?.customTag
				if (tag) tags.add(tag)
			}
		}
		return tags
	}
	/** 羁绊当前档位官方变量（data/set18/traits.ts vars） */
	const traitVarsOf = (side: 'A' | 'B', apiName: string): Record<string, number> => {
		const a = traitsOf(side).find((x) => x.apiName === apiName)
		const def = TRAIT_BY_API.get(apiName)
		return (a && def?.vars[a.breakpointIndex]) || {}
	}

	const dealDamage: DealDamageFn = (src, dst, raw, type, canCrit, tNow) =>
		dealDamageImpl(deps, src, dst, raw, type, canCrit, tNow)

	const healUnit = (src: CombatUnit, dst: CombatUnit, amount: number, tNow: number) => {
		if (!dst.alive) return
		const healed = Math.round(amount * healFactor(dst, tNow))
		dst.hp = Math.min(dst.stats.maxHp, dst.hp + healed)
		emit({ t: tNow, type: 'heal', uid: src.uid, target: dst.uid, value: healed })
	}

	/** 施法暴击判定：装备/霸符/羁绊 */
	const abilityCanCrit = (u: CombatUnit) =>
		u.tags.includes('abilityCrit') || traitTagsOf(u.side)?.has('ability-crit') === true

	// ---------- 插件上下文 ----------

	const makeCtx = (u: CombatUnit): AbilityCtx => makeAbilityCtx(deps, u, t)

	const spawnSummonBound = (
		owner: CombatUnit,
		apiName: string,
		spot: HexPos,
		o?: SummonOpts,
	): CombatUnit => {
		summonSeq += 1
		return spawnSummon(spawn, `${owner.uid}-s${summonSeq}`, owner, apiName, spot, o)
	}

	// ---------- 羁绊插件（每场战斗实例化一次，可持闭包状态） ----------

	const instantiateTraits = (side: 'A' | 'B') => {
		const out: { apiName: string; plugin: import('./plugins/types').TraitCombatPlugin }[] = []
		for (const a of traitsOf(side)) {
			const factory = TRAIT_PLUGINS[a.apiName]
			if (factory)
				out.push({
					apiName: a.apiName,
					plugin: factory(traitVarsOf(side, a.apiName), a.breakpointIndex),
				})
		}
		return out
	}
	const traitInstA = instantiateTraits('A')
	const traitInstB = instantiateTraits('B')
	const traitPluginsOf = (side: 'A' | 'B') =>
		(side === 'A' ? traitInstA : traitInstB).map((x) => x.plugin)

	const makeTraitCtx = (side: 'A' | 'B'): TraitCtx => {
		const anchor = units.find((u) => u.alive && u.side === side) ?? units[0]
		const base = makeCtx(anchor)
		const params: Record<string, number> = {}
		for (const { apiName } of side === 'A' ? traitInstA : traitInstB) {
			for (const [k, v] of Object.entries(traitVarsOf(side, apiName))) {
				params[`${apiName}.${k}`] = v
			}
		}
		return {
			...base,
			params,
			sideUnits: (s) => units.filter((u) => u.alive && u.side === s),
			metric: (key, delta) => {
				metricsBy[side][key] = (metricsBy[side][key] ?? 0) + delta
			},
		}
	}

	// 注入内部机制模块（combatInternal）的战场依赖
	const deps: CombatDeps = {
		units,
		byUid,
		rng,
		overtimeAmp: () => overtimeAmp,
		emit,
		isFree,
		rebuildOccupied,
		recordDeath,
		nearestEnemy,
		dealDamage,
		healUnit,
		abilityCanCrit,
		spawnSummon: spawnSummonBound,
		makeCtx,
		makeTraitCtx,
		traitPluginsOf,
		metric: (side, key, delta) => {
			metricsBy[side][key] = (metricsBy[side][key] ?? 0) + delta
		},
	}

	// ---------- 施法 ----------

	const castAbility = (u: CombatUnit, tNow: number) => {
		u.mana = 0
		u.castCount += 1
		// 破法：下次施放蓝耗 +35%，施放后消耗
		u.statuses = u.statuses.filter((s) => s.kind !== 'manaReave')
		const plugin = ABILITY_PLUGINS.get(u.apiName)
		if (plugin?.cast) {
			const ctx = makeCtx(u)
			plugin.cast(ctx)
			const fxDone = (ctx as unknown as { __fxDone: () => boolean }).__fxDone()
			if (!fxDone) {
				const spec = u.ability
				const target = u.target ? byUid.get(u.target) : null
				emit({
					t: tNow,
					type: 'cast',
					uid: u.uid,
					pos: target?.alive ? target.cpos : u.cpos,
					aoe: spec.kind === 'aoe' ? spec.aoeRange : 0,
					spell: 'damage',
				})
			}
		} else {
			genericCast(deps, u, tNow)
		}
		for (const p of traitPluginsOf(u.side)) p.onCast?.(u.side, u, makeTraitCtx(u.side))
		// 激发之匣：施法后在 Duration 秒里持续回复 PercentHealth% 最大生命（多件叠加速率）
		if (u.tags.includes('innervatingLocket') && u.alive) {
			const hpPct =
				(itemEffectNum('TFT_Item_Artifact_InnervatingLocket', 'PercentHealth') ?? 20) / 100
			const dur = itemEffectNum('TFT_Item_Artifact_InnervatingLocket', 'Duration') ?? 3
			const n = u.items.filter((i) => i === 'TFT_Item_Artifact_InnervatingLocket').length || 1
			u.hotRate = (u.stats.maxHp * hpPct * n) / dur
			u.hotLeft = dur
		}
	}

	// ---------- 开战钩子 ----------

	for (const u of units) {
		ABILITY_PLUGINS.get(u.apiName)?.onCombatStart?.(makeCtx(u))
	}
	for (const side of ['A', 'B'] as const) {
		for (const p of traitPluginsOf(side))
			p.onCombatStart?.(
				side,
				units.filter((u) => u.side === side && u.alive),
				makeTraitCtx(side),
			)
	}
	// 碰撞测试假人：开战发射至敌人最密集处，晕眩周围 1 格敌人
	for (const u of units) {
		if (!u.alive || !u.crashTestStun) continue
		const foes = units.filter((e) => e.alive && e.side !== u.side)
		let best: HexPos | null = null
		let bestN = 0
		for (const e of foes) {
			const n = foes.filter((x) => hexDistance(x.cpos, e.cpos) <= 1).length
			if (n > bestN) {
				bestN = n
				best = e.cpos
			}
		}
		if (!best) continue
		const spot = nearestFreeInRange(best, 1, isFree)
		if (spot) {
			u.cpos = spot
			rebuildOccupied()
			emit({ t: 0, type: 'move', uid: u.uid, pos: spot })
		}
		emit({ t: 0, type: 'status', uid: u.uid, pos: u.cpos, statusKind: 'stun' })
		for (const e of foes.filter((x) => hexDistance(x.cpos, u.cpos) <= 1)) {
			applyCc(e, { kind: 'stun', value: 0, until: u.crashTestStun }, 0)
		}
	}

	const maxTicks = Math.round(maxSeconds / TICK_S)
	let winner: 'A' | 'B' | 'draw' = 'draw'
	for (let tick = 1; tick <= maxTicks; tick++) {
		t = tick * TICK_S
		if (t > maxSeconds * 0.7) overtimeAmp += OVERTIME_AMP_PER_TICK * TICK_S * 10

		for (const u of units) {
			if (!u.alive) continue
			u.mem.aliveT = t
			// 飞升护符：22 秒后 +100% 最大生命与 +120% 伤害增幅
			if (u.tags.includes('ascension') && !u.mem.ascended && t >= 22) {
				u.mem.ascended = 1
				const gain = u.stats.maxHp
				u.stats.maxHp = gain * 2
				u.hp += gain
				u.stats.damageAmp += 1.2
				emit({ t, type: 'heal', uid: u.uid, value: gain })
			}
			// 激发之匣 HoT 计时（与 DoT 同tick结算）
			if (u.hotLeft > 0) {
				u.hotLeft -= TICK_S
				healUnit(u, u, u.hotRate * TICK_S, t)
			}
			// DoT / debuff 计时
			if (u.burnLeft > 0) {
				u.burnLeft -= TICK_S
				const anyEnemy = units.find((e) => e.alive && e.side !== u.side)
				if (anyEnemy) {
					u.hp -= u.burnDps * TICK_S
					if (u.hp <= 0) {
						u.hp = 0
						u.alive = false
						emit({ t, type: 'death', uid: u.uid })
						recordDeath(u)
						rebuildOccupied()
						continue
					}
				}
			}
			// 流血（每层独立计时）
			for (const s of u.statuses) {
				if (s.kind !== 'bleed' || s.until <= t) continue
				u.hp -= s.value * TICK_S
				if (u.hp <= 0) {
					u.hp = 0
					u.alive = false
					emit({ t, type: 'death', uid: u.uid })
					recordDeath(u)
					rebuildOccupied()
					break
				}
			}
			if (!u.alive) continue
			if (u.shredLeft > 0) u.shredLeft -= TICK_S
			if (u.stats.manaRegen > 0)
				u.mana = Math.min(u.stats.mana, u.mana + u.stats.manaRegen * TICK_S)
			if (u.tags.includes('apStack')) {
				// 羊刀类：每 5 秒获得法术加成
				u.apTimer += TICK_S
				if (u.apTimer >= 5) {
					u.apTimer = 0
					u.stats.abilityPower += 20
				}
			}
			if (u.atkCd > 0) u.atkCd -= TICK_S
			if (u.moveCd > 0) u.moveCd -= TICK_S
			// 限时增益到期回收
			for (let i = u.buffs.length - 1; i >= 0; i--) {
				if (u.buffs[i].until <= t) {
					for (const k of Object.keys(u.buffs[i].mods) as (keyof CombatStats)[]) {
						u.stats[k] -= u.buffs[i].mods[k] ?? 0
					}
					u.buffs.splice(i, 1)
				}
			}

			ABILITY_PLUGINS.get(u.apiName)?.onTick?.(makeCtx(u))
			for (const p of traitPluginsOf(u.side))
				p.onTick?.(
					u.side,
					units.filter((x) => x.alive && x.side === u.side),
					makeTraitCtx(u.side),
				)

			const enemies = units.filter((e) => e.alive && e.side !== u.side)
			if (enemies.length === 0) break

			// 硬控：不能行动
			if (isDisabled(u, t) || u.mem.noAct) continue

			// 施放（破法提高下次蓝耗）
			const manaCost = u.stats.mana * (hasStatus(u, 'manaReave', t) ? 1.35 : 1)
			if (u.mana >= manaCost && u.stats.mana > 0 && Number.isFinite(u.stats.mana)) {
				castAbility(u, t)
				continue
			}

			// 索敌（嘲讽强制目标；鱼骨头随机瞄准）
			let target = u.target ? byUid.get(u.target) : null
			const taunt = getStatus(u, 'taunt', t)
			if (taunt?.source) {
				const taunter = byUid.get(taunt.source)
				if (taunter?.alive) target = taunter
			}
			if (!target || !target.alive || hasStatus(target, 'untargetable', t)) {
				target =
					u.tags.includes('randomTarget') && enemies.length > 0
						? enemies[rng.int(enemies.length)]
						: nearestEnemy(u, enemies)
				u.target = target?.uid ?? null
			}
			if (!target) continue

			if (hexDistance(u.cpos, target.cpos) <= u.stats.range) {
				// 普攻
				if (u.atkCd <= 0) {
					const as =
						u.stats.attackSpeed *
						(u.tags.includes('asStack') ? 1 + 0.05 * u.asStacks : 1) *
						slowFactor(u, t)
					u.atkCd = 1 / Math.max(0.2, as)
					if (u.tags.includes('asStack')) u.asStacks += 1
					u.mana = Math.min(u.stats.mana, u.mana + MANA_PER_ATTACK)
					u.attackCount += 1
					emit({ t, type: 'attack', uid: u.uid, target: target.uid })
					const plugin = ABILITY_PLUGINS.get(u.apiName)
					const ctx = makeCtx(u)
					const raw = plugin?.modifyAttack
						? plugin.modifyAttack(ctx, target, u.stats.attackDamage)
						: u.stats.attackDamage
					if (raw > 0) dealDamage(u, target, raw, 'physical', true, t)
					plugin?.onAttack?.(ctx, target, raw)
					for (const p of traitPluginsOf(u.side))
						p.onAttack?.(u.side, u, target, makeTraitCtx(u.side))
					// 巨型九头蛇：对目标及邻格敌人追加 4% 最大生命 + 6% AD 物理伤害
					if (u.tags.includes('splashOnHit') && raw > 0) {
						const bonus = u.stats.maxHp * 0.04 + u.stats.attackDamage * 0.06
						for (const e of units.filter(
							(x) => x.alive && x.side !== u.side && hexDistance(x.cpos, target.cpos) <= 1,
						))
							dealDamage(u, e, bonus, 'physical', false, t)
					}
					// 智慧末刃：普攻追加随阶段成长的魔法伤害，治疗携带者其 PercentHealing%
					if (u.tags.includes('onhitMagic') && target.alive) {
						const stageIdx = Math.max(0, Math.min(stage, 8) - 1)
						const md = dealDamage(u, target, WITS_END_STAGE_DAMAGE[stageIdx], 'magic', false, t)
						const healPct =
							(itemEffectNum('TFT_Item_Artifact_WitsEnd', 'PercentHealing') ?? 30) / 100
						if (md > 0) healUnit(u, u, md * healPct, t)
					}
				}
			} else if (u.moveCd <= 0) {
				const step = stepToward(u.cpos, target.cpos, isFree)
				if (step) {
					u.cpos = step
					rebuildOccupied()
					emit({ t, type: 'move', uid: u.uid, pos: step })
				}
				u.moveCd = 0.4
			}
		}

		const aliveA = units.filter((u) => u.alive && u.side === 'A').length
		const aliveB = units.filter((u) => u.alive && u.side === 'B').length
		if (aliveA === 0 || aliveB === 0) {
			winner = aliveA === 0 && aliveB === 0 ? 'draw' : aliveA > 0 ? 'A' : 'B'
			break
		}
	}

	const survivorsA = units.filter((u) => u.alive && u.side === 'A').length
	const survivorsB = units.filter((u) => u.alive && u.side === 'B').length
	if (winner === 'draw' && t >= maxSeconds - 1e-9) {
		if (survivorsA !== survivorsB) winner = survivorsA > survivorsB ? 'A' : 'B'
	}
	const damageDealt: Record<string, number> = {}
	const damageTaken: Record<string, number> = {}
	for (const u of units) {
		damageDealt[u.uid] = Math.round(u.damageDealt)
		damageTaken[u.uid] = Math.round(u.damageTaken)
		// 假人金币：按存活时长折算（每 N 秒 N 金）
		if (u.dummyGold) {
			const [perSeconds, amount] = u.dummyGold
			const gold = Math.floor((u.mem.aliveT ?? 0) / perSeconds) * amount
			if (gold > 0) metricsBy[u.side].dummyGold = (metricsBy[u.side].dummyGold ?? 0) + gold
		}
		// 替罪羊：该假人是全队最先阵亡者
		if (u.scapegoatGold && firstDeath[u.side] === u.apiName) {
			metricsBy[u.side].scapegoatGold = (metricsBy[u.side].scapegoatGold ?? 0) + u.scapegoatGold
		}
	}
	return {
		winner,
		survivorsA,
		survivorsB,
		durationMs: Math.round(t * 1000),
		events,
		damageDealt,
		damageTaken,
		metricsA: metricsBy.A,
		metricsB: metricsBy.B,
	}
}
