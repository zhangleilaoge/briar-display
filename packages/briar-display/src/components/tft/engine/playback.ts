import { toCombatRow } from './hex'
import type { CombatRecord } from './types'
import type { HexPos } from './types'

export interface PlaybackUnit {
	uid: string
	apiName: string
	star: number
	side: 'A' | 'B'
	/** 战斗网格坐标（8 行） */
	pos: HexPos
	hp: number
	maxHp: number
	mana: number
	maxMana: number
	alive: boolean
	/** 死亡时刻（秒），用于死亡淡出；-1 未死 */
	deathAt: number
	/** 最近一次施法/普攻的播放时刻（秒），用于闪光动画 */
	castAt: number
	attackAt: number
	/** 普攻目标位置（近战突进用） */
	attackTo: HexPos | null
	/** 远程（射程>=2）普攻渲染弹道 */
	ranged: boolean
	isSummon: boolean
}

export interface FloatText {
	key: number
	t: number
	pos: HexPos
	value: number
	crit: boolean
	kind: 'damage' | 'heal' | 'shield'
}

/** 远程普攻弹道：from→to 直线飞行 */
export interface Shot {
	key: number
	t: number
	from: HexPos
	to: HexPos
}

/** 施法特效：技能弹道 + 落点范围提示 */
export interface CastFx {
	key: number
	t: number
	from: HexPos
	to: HexPos
	aoe: number
	spell: 'damage' | 'heal' | 'shield' | 'buff'
}

const FLOAT_TTL = 0.8
const SHOT_TTL = 0.28
const CAST_TTL = 0.6
const DEATH_FADE = 0.45

/** 把一场战斗的事件流增量折叠成棋面帧；t 单调递增 */
export class CombatPlayback {
	private units = new Map<string, PlaybackUnit>()
	private idx = 0
	private floatSeq = 0
	private shotSeq = 0
	private castSeq = 0
	recentFloats: FloatText[] = []
	recentShots: Shot[] = []
	recentCasts: CastFx[] = []

	constructor(private record: CombatRecord) {
		const init = (side: 'A' | 'B') => {
			const inputs = side === 'A' ? record.inputsA : record.inputsB
			for (const u of inputs) {
				this.units.set(u.uid, {
					uid: u.uid,
					apiName: u.apiName,
					star: u.star,
					side,
					pos: {
						col: u.pos.col,
						row: toCombatRow(u.pos.row, side === 'A' ? 'defender' : 'attacker'),
					},
					hp: u.stats.maxHp,
					maxHp: u.stats.maxHp,
					mana: Math.min(u.stats.initialMana, u.stats.mana),
					maxMana: Number.isFinite(u.stats.mana) ? u.stats.mana : 0,
					alive: true,
					deathAt: -1,
					castAt: -1,
					attackAt: -1,
					attackTo: null,
					ranged: u.stats.range >= 2,
					isSummon: false,
				})
			}
		}
		init('A')
		init('B')
	}

	get duration(): number {
		return this.record.result.durationMs / 1000
	}

	get source(): CombatRecord {
		return this.record
	}

	/** 返回可见单位（含死亡淡出中的） */
	advanceTo(t: number): PlaybackUnit[] {
		const evs = this.record.result.events
		while (this.idx < evs.length && evs[this.idx].t <= t) {
			this.apply(evs[this.idx])
			this.idx++
		}
		this.recentFloats = this.recentFloats.filter((f) => t - f.t < FLOAT_TTL)
		this.recentShots = this.recentShots.filter((s) => t - s.t < SHOT_TTL)
		this.recentCasts = this.recentCasts.filter((c) => t - c.t < CAST_TTL)
		return [...this.units.values()].filter((u) => u.alive || t - u.deathAt < DEATH_FADE)
	}

	private apply(e: CombatRecord['result']['events'][number]): void {
		const u = this.units.get(e.uid)
		const target = e.target ? this.units.get(e.target) : undefined
		switch (e.type) {
			case 'move':
				if (u && e.pos) u.pos = e.pos
				break
			case 'attack':
				if (u) {
					u.attackAt = e.t
					if (u.maxMana > 0) u.mana = Math.min(u.maxMana, u.mana + 10)
					if (target) {
						u.attackTo = { ...target.pos }
						if (u.ranged) {
							this.shotSeq += 1
							this.recentShots.push({
								key: this.shotSeq,
								t: e.t,
								from: { ...u.pos },
								to: { ...target.pos },
							})
						}
					}
				}
				break
			case 'cast':
				if (u) {
					u.castAt = e.t
					u.mana = 0
					this.castSeq += 1
					this.recentCasts.push({
						key: this.castSeq,
						t: e.t,
						from: { ...u.pos },
						to: e.pos ? { ...e.pos } : { ...u.pos },
						aoe: e.aoe ?? 0,
						spell: e.spell ?? 'damage',
					})
				}
				break
			case 'damage':
				if (target) {
					target.hp = Math.max(0, target.hp - (e.value ?? 0))
					this.pushFloat(e.t, target.pos, e.value ?? 0, e.crit === true, 'damage')
				}
				break
			case 'heal':
				if (target) {
					target.hp = Math.min(target.maxHp, target.hp + (e.value ?? 0))
					this.pushFloat(e.t, target.pos, e.value ?? 0, false, 'heal')
				}
				break
			case 'death':
				if (u?.alive) {
					u.alive = false
					u.deathAt = e.t
				}
				break
			case 'summon':
				if (e.target && e.pos) {
					this.units.set(e.target, {
						uid: e.target,
						// 召唤物沿用召唤者的棋子 apiName（事件 uid 是召唤者 uid，不能直接当 apiName）
						apiName: u?.apiName ?? e.uid,
						star: 1,
						side: u?.side ?? 'A',
						pos: e.pos,
						hp: e.value ?? 1,
						maxHp: e.value ?? 1,
						mana: 0,
						maxMana: 0,
						alive: true,
						deathAt: -1,
						castAt: -1,
						attackAt: -1,
						attackTo: null,
						ranged: false,
						isSummon: true,
					})
				}
				break
			case 'shield':
				if (target) this.pushFloat(e.t, target.pos, e.value ?? 0, false, 'shield')
				else if (u) this.pushFloat(e.t, u.pos, e.value ?? 0, false, 'shield')
				break
		}
	}

	private pushFloat(t: number, pos: HexPos, value: number, crit: boolean, kind: FloatText['kind']) {
		this.floatSeq += 1
		this.recentFloats.push({
			key: this.floatSeq,
			t,
			pos: { ...pos },
			value: Math.round(value),
			crit,
			kind,
		})
	}
}
