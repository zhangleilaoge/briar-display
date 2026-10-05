import {
	COMBAT_MAX_SECONDS,
	COMBAT_TICK_MS,
	MANA_PER_ATTACK,
	MANA_PER_DAMAGE_TAKEN,
	MANA_TAKEN_CAP,
	OVERTIME_AMP_PER_TICK,
} from '../data/rules'
import { type AbilitySpec, abilityScale, resolveAbility } from './abilities'
import { hexDistance, hexesInRange, nearestFreeInRange, stepToward, toCombatRow } from './hex'
import { type ItemTag, itemTags } from './items'
import type { Rng } from './rng'
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
}

export interface CombatEvent {
	t: number
	type: 'move' | 'attack' | 'cast' | 'damage' | 'heal' | 'shield' | 'death' | 'summon'
	uid: string
	target?: string
	value?: number
	pos?: HexPos
	crit?: boolean
}

export interface CombatResult {
	winner: 'A' | 'B' | 'draw'
	survivorsA: number
	survivorsB: number
	durationMs: number
	events: CombatEvent[]
	damageDealt: Record<string, number>
}

interface CombatUnit extends CombatUnitInput {
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
	shredLeft: number
	lowhpShieldUsed: boolean
	damageDealt: number
	/** summon 防爆格上限 */
	summonsLeft: number
}

interface CombatOptions {
	rng: Rng
	/** 双方激活羁绊的机制标签（traitEffects customTag） */
	traitTagsA?: Set<string>
	traitTagsB?: Set<string>
	recordEvents?: boolean
	maxSeconds?: number
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
	const events: CombatEvent[] = []
	const units: CombatUnit[] = []
	let summonSeq = 0

	const spawn = (input: CombatUnitInput, side: 'A' | 'B'): CombatUnit => ({
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
		tags: input.items.flatMap(itemTags),
		asStacks: 0,
		apTimer: 0,
		burnDps: 0,
		burnLeft: 0,
		shredLeft: 0,
		lowhpShieldUsed: false,
		damageDealt: 0,
		summonsLeft: 4,
	})
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

	const emit = (e: CombatEvent) => {
		if (record) events.push(e)
	}

	let overtimeAmp = 0

	const dealDamage = (
		src: CombatUnit,
		dst: CombatUnit,
		raw: number,
		type: 'physical' | 'magic' | 'true',
		canCrit: boolean,
		t: number,
	) => {
		if (!dst.alive) return 0
		let resist =
			type === 'physical' ? dst.stats.armor : type === 'magic' ? dst.stats.magicResist : 0
		if (dst.shredLeft > 0) resist *= 0.7
		let dmg = raw * (1 + src.stats.damageAmp + overtimeAmp) * (1 - dst.stats.damageReduction)
		if (type !== 'true') dmg *= 100 / (100 + Math.max(0, resist))
		if (src.tags.includes('giantSlayer') && dst.stats.maxHp > 1600) dmg *= 1.2
		let crit = false
		if (canCrit && rng.next() < src.stats.critChance) {
			dmg *= src.stats.critMultiplier
			crit = true
		}
		dmg = Math.max(1, Math.round(dmg))
		// 受伤回蓝 = 最终伤害 x 系数，单次封顶
		const manaGain = Math.min(dmg * MANA_PER_DAMAGE_TAKEN, MANA_TAKEN_CAP)
		dst.mana = Math.min(dst.stats.mana, dst.mana + manaGain)
		if (dst.shield > 0) {
			const absorbed = Math.min(dst.shield, dmg)
			dst.shield -= absorbed
			dmg -= absorbed
		}
		dst.hp -= dmg
		src.damageDealt += dmg
		if (src.stats.omnivamp > 0)
			src.hp = Math.min(src.stats.maxHp, src.hp + dmg * src.stats.omnivamp)
		emit({ t, type: 'damage', uid: src.uid, target: dst.uid, value: dmg, crit })
		if (dst.hp <= 0) {
			dst.hp = 0
			dst.alive = false
			emit({ t, type: 'death', uid: dst.uid })
			rebuildOccupied()
			const srcTags = src.side === 'A' ? opts.traitTagsA : opts.traitTagsB
			if (srcTags?.has('flora-harvest')) {
				src.mana = Math.min(src.stats.mana, src.mana + 20)
				const allies = units.filter((u) => u.alive && u.side === src.side)
				const lowest = allies.sort((a, b) => a.hp / a.stats.maxHp - b.hp / b.stats.maxHp)[0]
				if (lowest) {
					lowest.hp = Math.min(lowest.stats.maxHp, lowest.hp + lowest.stats.maxHp * 0.15)
					emit({ t, type: 'heal', uid: lowest.uid, value: Math.round(lowest.stats.maxHp * 0.15) })
				}
			}
		} else {
			// 低血护盾类装备：每场一次
			if (
				!dst.lowhpShieldUsed &&
				dst.tags.includes('lowhpShield') &&
				dst.hp < dst.stats.maxHp * 0.4
			) {
				dst.lowhpShieldUsed = true
				dst.shield += dst.stats.maxHp * 0.25
				emit({ t, type: 'shield', uid: dst.uid, value: Math.round(dst.stats.maxHp * 0.25) })
			}
			// 击中附伤类
			if (
				src.tags.includes('burnOnHit') ||
				(src.side === 'A' ? opts.traitTagsA : opts.traitTagsB)?.has('inferno-burn')
			) {
				dst.burnDps = Math.max(dst.burnDps, dst.stats.maxHp * 0.01)
				dst.burnLeft = Math.max(dst.burnLeft, 3)
			}
			if (
				src.tags.includes('mrShredOnHit') ||
				(src.side === 'A' ? opts.traitTagsA : opts.traitTagsB)?.has('caustic-shred')
			) {
				dst.shredLeft = 4
			}
		}
		return dmg
	}

	const healUnit = (src: CombatUnit, dst: CombatUnit, amount: number, t: number) => {
		if (!dst.alive) return
		const healed = Math.round(amount)
		dst.hp = Math.min(dst.stats.maxHp, dst.hp + healed)
		emit({ t, type: 'heal', uid: src.uid, target: dst.uid, value: healed })
	}

	const castAbility = (u: CombatUnit, t: number) => {
		u.mana = 0
		emit({ t, type: 'cast', uid: u.uid })
		const spec = u.ability
		const scale = abilityScale(spec, u.stats)
		const value = spec.values[u.star - 1] * scale
		const enemies = units.filter((e) => e.alive && e.side !== u.side)
		const allies = units.filter((e) => e.alive && e.side === u.side)
		const target = (u.target ? byUid.get(u.target) : null) ?? null
		const canCrit =
			u.tags.includes('abilityCrit') ||
			(u.side === 'A' ? opts.traitTagsA : opts.traitTagsB)?.has('ability-crit') === true

		switch (spec.kind) {
			case 'strike': {
				const dst = target?.alive ? target : nearestEnemy(u, enemies)
				if (dst) dealDamage(u, dst, value, spec.damageType, canCrit, t)
				break
			}
			case 'aoe': {
				const center = target?.alive ? target : nearestEnemy(u, enemies)
				if (!center) break
				const victims =
					spec.aoeRange >= 99
						? enemies
						: enemies.filter((e) => hexDistance(e.cpos, center.cpos) <= spec.aoeRange)
				for (const v of victims) dealDamage(u, v, value, spec.damageType, canCrit, t)
				break
			}
			case 'dot': {
				const dst = target?.alive ? target : nearestEnemy(u, enemies)
				if (dst) {
					dst.burnDps = Math.max(dst.burnDps, value / spec.dotSeconds)
					dst.burnLeft = Math.max(dst.burnLeft, spec.dotSeconds)
				}
				break
			}
			case 'heal': {
				const lowest = allies.sort((a, b) => a.hp / a.stats.maxHp - b.hp / b.stats.maxHp)[0]
				if (lowest) healUnit(u, lowest, value, t)
				break
			}
			case 'shield': {
				const lowest = allies.sort((a, b) => a.hp / a.stats.maxHp - b.hp / b.stats.maxHp)[0]
				if (lowest) {
					lowest.shield += value
					emit({ t, type: 'shield', uid: u.uid, target: lowest.uid, value: Math.round(value) })
				}
				break
			}
			case 'buff':
			case 'transform': {
				u.stats.attackSpeed *= 1 + value / 200
				u.stats.attackDamage *= 1 + value / 300
				if (spec.kind === 'transform') healUnit(u, u, u.stats.maxHp * 0.3, t)
				break
			}
			case 'dash': {
				const dst = target?.alive ? target : nearestEnemy(u, enemies)
				if (!dst) break
				const spot = nearestFreeInRange(dst.cpos, 1, isFree)
				if (spot) {
					u.cpos = spot
					rebuildOccupied()
					emit({ t, type: 'move', uid: u.uid, pos: spot })
				}
				dealDamage(u, dst, value, spec.damageType, canCrit, t)
				break
			}
			case 'summon': {
				for (let i = 0; i < spec.summonCount && u.summonsLeft > 0; i++) {
					const spot = nearestFreeInRange(u.cpos, 1, isFree)
					if (!spot) break
					u.summonsLeft -= 1
					summonSeq += 1
					const sstats = { ...u.stats }
					sstats.maxHp = Math.round(value * 3)
					sstats.attackDamage = Math.round(value * 0.4)
					sstats.attackSpeed = 0.7
					sstats.mana = Number.POSITIVE_INFINITY
					sstats.initialMana = 0
					sstats.range = 1
					const su: CombatUnit = {
						uid: `${u.uid}-s${summonSeq}`,
						apiName: u.apiName,
						star: 1,
						pos: { col: spot.col, row: spot.row },
						stats: sstats,
						items: [],
						side: u.side,
						cpos: spot,
						hp: sstats.maxHp,
						shield: 0,
						mana: 0,
						target: null,
						atkCd: 0.3,
						moveCd: 0,
						alive: true,
						ability: {
							kind: 'buff',
							name: '召唤物',
							damageType: 'magic',
							values: [0, 0, 0],
							aoeRange: 0,
							dotSeconds: 0,
							summonCount: 0,
						},
						tags: [],
						asStacks: 0,
						apTimer: 0,
						burnDps: 0,
						burnLeft: 0,
						shredLeft: 0,
						lowhpShieldUsed: true,
						damageDealt: 0,
						summonsLeft: 0,
					}
					units.push(su)
					byUid.set(su.uid, su)
					rebuildOccupied()
					emit({ t, type: 'summon', uid: u.uid, target: su.uid, pos: spot, value: sstats.maxHp })
				}
				break
			}
		}
	}

	const nearestEnemy = (u: CombatUnit, enemies: CombatUnit[]): CombatUnit | null => {
		let best: CombatUnit | null = null
		let bestD = Number.POSITIVE_INFINITY
		for (const e of enemies) {
			const d = hexDistance(u.cpos, e.cpos)
			if (d < bestD || (d === bestD && best && e.hp < best.hp)) {
				best = e
				bestD = d
			}
		}
		return best
	}

	// 日月双蚀：每 6 秒斩杀最低生命敌人（真实伤害）
	let eclipseTimerA = 6
	let eclipseTimerB = 6

	const maxTicks = Math.round(maxSeconds / TICK_S)
	let t = 0
	let winner: 'A' | 'B' | 'draw' = 'draw'
	for (let tick = 1; tick <= maxTicks; tick++) {
		t = tick * TICK_S
		if (t > maxSeconds * 0.7) overtimeAmp += OVERTIME_AMP_PER_TICK * TICK_S * 10

		for (const u of units) {
			if (!u.alive) continue
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
						rebuildOccupied()
						continue
					}
				}
			}
			if (u.shredLeft > 0) u.shredLeft -= TICK_S
			if (u.stats.manaRegen > 0)
				u.mana = Math.min(u.stats.mana, u.mana + u.stats.manaRegen * TICK_S)
			if (u.tags.includes('apStack')) {
				u.apTimer += TICK_S
				if (u.apTimer >= 5) {
					u.apTimer = 0
					u.stats.abilityPower += 20
				}
			}
			if (u.atkCd > 0) u.atkCd -= TICK_S
			if (u.moveCd > 0) u.moveCd -= TICK_S

			const enemies = units.filter((e) => e.alive && e.side !== u.side)
			if (enemies.length === 0) break

			// 施放
			if (u.mana >= u.stats.mana && u.stats.mana > 0 && Number.isFinite(u.stats.mana)) {
				castAbility(u, t)
				continue
			}

			// 索敌
			let target = u.target ? byUid.get(u.target) : null
			if (!target || !target.alive) {
				target = nearestEnemy(u, enemies)
				u.target = target?.uid ?? null
			}
			if (!target) continue

			if (hexDistance(u.cpos, target.cpos) <= u.stats.range) {
				// 普攻
				if (u.atkCd <= 0) {
					const as = u.stats.attackSpeed * (u.tags.includes('asStack') ? 1 + 0.05 * u.asStacks : 1)
					u.atkCd = 1 / Math.max(0.2, as)
					if (u.tags.includes('asStack')) u.asStacks += 1
					u.mana = Math.min(u.stats.mana, u.mana + MANA_PER_ATTACK)
					emit({ t, type: 'attack', uid: u.uid, target: target.uid })
					dealDamage(u, target, u.stats.attackDamage, 'physical', true, t)
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

		// 日月双蚀
		for (const side of ['A', 'B'] as const) {
			const tags = side === 'A' ? opts.traitTagsA : opts.traitTagsB
			if (!tags?.has('eclipse-execute')) continue
			if (side === 'A') eclipseTimerA -= TICK_S
			else eclipseTimerB -= TICK_S
			const timer = side === 'A' ? eclipseTimerA : eclipseTimerB
			if (timer <= 0) {
				if (side === 'A') eclipseTimerA = 6
				else eclipseTimerB = 6
				const enemies = units.filter((e) => e.alive && e.side !== side)
				const lowest = enemies.sort((a, b) => a.hp - b.hp)[0]
				if (lowest) {
					const src = units.find((e) => e.alive && e.side === side)
					if (src) dealDamage(src, lowest, lowest.stats.maxHp * 0.5, 'true', false, t)
				}
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
	for (const u of units) damageDealt[u.uid] = Math.round(u.damageDealt)
	return {
		winner,
		survivorsA,
		survivorsB,
		durationMs: Math.round(t * 1000),
		events,
		damageDealt,
	}
}
