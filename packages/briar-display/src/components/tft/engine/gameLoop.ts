import {
	BENCH_SIZE,
	CAROUSEL_COST_WEIGHTS,
	CAROUSEL_PICK_SECONDS,
	COMBAT_BUFFER_SECONDS,
	ENCOUNTER_SECONDS,
	ITEM_TRAY_SIZE,
	PASSIVE_XP,
	PLANNING_SECONDS,
	PVE_DROPS,
	SHOP_REFRESH_COST,
	SHOP_SIZE,
	STAGE1_ROUNDS,
	STAGE_ROUNDS,
	STARTING_HP,
	isAugmentRound,
	roundType,
} from '../data/rules'
import { CHAMPIONS, ITEM_COMPONENTS } from '../data/set18'
import { AUGMENTS, AUGMENT_BY_API, ENCOUNTERS } from '../data/set18/augments'
import { MONSTER_BY_API, pveStatScale, pveWaveFor } from '../data/set18/monsters'
import { aiTakeTurn } from './ai'
import { type CombatResult, type CombatUnitInput, simulateCombat } from './combat'
import { applyXp, buyXp as engineBuyXp, playerDamage, roundIncome } from './economy'
import { CardPool } from './pool'
import { type Rng, makeRng } from './rng'
import { TRAIT_EFFECTS, applyTraitStats } from './traitEffects'
import { computeActiveTraits } from './traits'
import type { Phase, PlayerState } from './types'
import {
	addToBench,
	costOf,
	createUnit,
	equipItem as engineEquipItem,
	sellUnit as engineSellUnit,
	moveToBench,
	placeOnBoard,
	resetUidSeq,
	unitStats,
} from './units'

export interface CarouselSlot {
	apiName: string
	item: string
}

export interface CombatRecord {
	opponentId: number
	opponentName: string
	isGhost: boolean
	isPvE: boolean
	/** 本玩家视角的 side */
	playerSide: 'A' | 'B'
	result: CombatResult
	/** 开战时的双方输入（UI 回放初始帧） */
	inputsA: CombatUnitInput[]
	inputsB: CombatUnitInput[]
}

export interface GameState {
	phase: Phase
	stage: number
	round: number
	gameTime: number
	phaseEndsAt: number
	players: PlayerState[]
	winnerId: number | null
	carousel: CarouselSlot[]
	carouselQueue: number[]
	currentPickerIndex: number
	pickEndsAt: number
	combats: Map<number, CombatRecord>
	/** 战斗阶段开始的 gameTime（UI 回放锚点） */
	combatStartAt: number
	/** 每个 bot 下一次行动的 gameTime */
	botActAt: Map<number, number>
	/** PvE 回合备战阶段预生成并展示的野怪波次（开战时直接使用同一波） */
	pveWave: CombatUnitInput[] | null
	/** 海克斯/遭遇三选一：pid → 候选 apiName；选完即从 map 删除 */
	augmentOffers: Map<number, string[]>
}

const BOT_NAMES = ['青钢影', '发条魔灵', '皮城女警', '暴走萝莉', '潮汐海灵', '暮光之眼', '荆棘之兴']

export class GameEngine {
	state: GameState
	private pool: CardPool
	private rng: Rng

	constructor(seed = Date.now()) {
		resetUidSeq()
		this.rng = makeRng(seed)
		this.pool = new CardPool()
		const players: PlayerState[] = Array.from({ length: 8 }, (_, i) => ({
			id: i,
			name: i === 0 ? '你' : BOT_NAMES[i - 1],
			isBot: i !== 0,
			hp: STARTING_HP,
			gold: 0,
			xp: 0,
			level: 1,
			streakType: 'none' as const,
			streakCount: 0,
			bench: Array(BENCH_SIZE).fill(null),
			board: [],
			itemTray: [],
			shop: Array(SHOP_SIZE).fill(null),
			shopLocked: false,
			alive: true,
			placement: 0,
			lastOpponentId: null,
			augments: [],
			freeRerolls: 0,
		}))
		this.state = {
			phase: 'encounter',
			stage: 1,
			round: 1,
			gameTime: 0,
			phaseEndsAt: ENCOUNTER_SECONDS * 1000,
			players,
			winnerId: null,
			carousel: [],
			carouselQueue: [],
			currentPickerIndex: 0,
			pickEndsAt: 0,
			combats: new Map(),
			combatStartAt: 0,
			botActAt: new Map(),
			pveWave: null,
			augmentOffers: new Map(),
		}
		this.genEncounter()
	}

	// ---------- 玩家操作（planning + combat 期间可用经济操作，摆位仅 planning） ----------

	private econBlocked(): boolean {
		return this.state.phase === 'carousel' || this.state.phase === 'encounter'
	}

	buyShopSlot(pid: number, slot: number): boolean {
		const p = this.alive(pid)
		if (!p || this.econBlocked()) return false
		const apiName = p.shop[slot]
		if (!apiName) return false
		const cost = costOf(apiName)
		if (p.gold < cost || p.bench.every((b) => b !== null)) return false
		if (!this.pool.take(apiName)) return false
		p.gold -= cost
		p.shop[slot] = null
		addToBench(p, createUnit(apiName))
		return true
	}

	refreshShop(pid: number): boolean {
		const p = this.alive(pid)
		if (!p || this.econBlocked()) return false
		if (p.freeRerolls > 0) p.freeRerolls -= 1
		else {
			if (p.gold < SHOP_REFRESH_COST) return false
			p.gold -= SHOP_REFRESH_COST
		}
		p.shopLocked = false
		p.shop = this.pool.rollShop(p.level, this.rng)
		return true
	}

	buyXp(pid: number): boolean {
		const p = this.alive(pid)
		if (!p || this.econBlocked()) return false
		return engineBuyXp(p)
	}

	toggleShopLock(pid: number): void {
		const p = this.alive(pid)
		if (p) p.shopLocked = !p.shopLocked
	}

	placeUnit(pid: number, uid: string, col: number, row: number): boolean {
		const p = this.alive(pid)
		if (!p || this.state.phase !== 'planning') return false
		return placeOnBoard(p, uid, col, row)
	}

	benchUnit(pid: number, uid: string, benchIndex: number): boolean {
		const p = this.alive(pid)
		if (!p || this.state.phase !== 'planning') return false
		return moveToBench(p, uid, benchIndex)
	}

	sellUnit(pid: number, uid: string): boolean {
		const p = this.alive(pid)
		if (!p || this.econBlocked()) return false
		const f = p.board.find((u) => u.uid === uid) ?? p.bench.find((u) => u?.uid === uid)
		if (!f) return false
		const gold = engineSellUnit(p, uid)
		if (gold === null) return false
		this.pool.addBack(f.apiName, 3 ** (f.star - 1))
		return true
	}

	equipItem(pid: number, uid: string, itemApi: string): boolean {
		const p = this.alive(pid)
		if (!p || this.state.phase !== 'planning') return false
		return engineEquipItem(p, uid, itemApi)
	}

	pickCarousel(pid: number, slotIndex: number): boolean {
		const s = this.state
		if (s.phase !== 'carousel') return false
		if (s.carouselQueue[s.currentPickerIndex] !== pid) return false
		const slot = s.carousel[slotIndex]
		if (!slot) return false
		s.carousel.splice(slotIndex, 1)
		this.grantCarouselUnit(pid, slot)
		this.nextPicker()
		return true
	}

	/** 海克斯/遭遇三选一；encounter 与 augment 回合共用 */
	pickAugment(pid: number, apiName: string): boolean {
		const s = this.state
		const offers = s.augmentOffers.get(pid)
		if (!offers || !offers.includes(apiName)) return false
		const p = s.players[pid]
		if (!p?.alive) return false
		s.augmentOffers.delete(pid)
		this.applyAugment(p, apiName)
		if (s.phase === 'encounter' && s.augmentOffers.size === 0) this.advanceRound()
		return true
	}

	/** debug：跳过当前阶段倒计时（超时路径会自动补选/结算） */
	skipPhase(): void {
		const s = this.state
		if (s.phase === 'planning' || s.phase === 'combat' || s.phase === 'encounter') {
			s.phaseEndsAt = s.gameTime
		} else if (s.phase === 'carousel') {
			s.pickEndsAt = s.gameTime
		}
	}

	/** debug：空转引擎直达指定回合的决策阶段（encounter/carousel/planning 即停） */
	jumpTo(stage: number, round: number): void {
		const s = this.state
		let guard = 20000
		while (guard-- > 0 && s.phase !== 'ended' && s.phase !== 'lobby') {
			if (s.stage === stage && s.round === round && s.phase !== 'combat') return
			this.tick(500)
		}
	}

	private applyAugment(p: PlayerState, apiName: string): void {
		const def = AUGMENT_BY_API.get(apiName)
		if (!def) return
		p.augments.push(apiName)
		for (const e of def.effects) {
			switch (e.kind) {
				case 'goldNow':
					p.gold += e.amount
					break
				case 'xpNow':
					applyXp(p, e.amount)
					break
				case 'components':
					for (let i = 0; i < e.count && p.itemTray.length < ITEM_TRAY_SIZE; i++) {
						p.itemTray.push(ITEM_COMPONENTS[this.rng.int(ITEM_COMPONENTS.length)].apiName)
					}
					break
				case 'unitWithItem': {
					const pool = CHAMPIONS.filter((c) => c.cost === e.cost)
					const apiName = pool[this.rng.int(pool.length)].apiName
					const u = createUnit(apiName)
					if (p.itemTray.length < ITEM_TRAY_SIZE) {
						u.items = [ITEM_COMPONENTS[this.rng.int(ITEM_COMPONENTS.length)].apiName]
					}
					if (!this.pool.take(apiName) || !addToBench(p, u)) {
						p.gold += e.cost
						this.pool.addBack(apiName, 1)
					}
					break
				}
				default:
					break
			}
		}
	}

	// ---------- 推进 ----------

	/** dt 为已按倍速缩放后的毫秒 */
	tick(dtMs: number): void {
		const s = this.state
		if (s.phase === 'ended' || s.phase === 'lobby') return
		s.gameTime += dtMs

		if (s.phase === 'encounter') {
			// bot 2s 后随机选；超时全部强制随机
			for (const [pid, offers] of [...s.augmentOffers]) {
				const p = s.players[pid]
				if (!p?.isBot) continue
				if (s.gameTime >= 2000) this.pickAugment(pid, offers[this.rng.int(offers.length)])
			}
			if (s.gameTime >= s.phaseEndsAt && s.augmentOffers.size > 0) {
				for (const [pid, offers] of [...s.augmentOffers]) {
					this.pickAugment(pid, offers[this.rng.int(offers.length)])
				}
			}
			return
		}

		if (s.phase === 'carousel') {
			const pickerId = s.carouselQueue[s.currentPickerIndex]
			if (pickerId !== undefined) {
				const p = s.players[pickerId]
				if (p.isBot && s.gameTime >= s.pickEndsAt - CAROUSEL_PICK_SECONDS * 1000 + 1500) {
					// bot 延迟 1.5s 后拿最高费
					const best = s.carousel
						.map((c, i) => ({ c, i }))
						.sort((a, b) => costOf(b.c.apiName) - costOf(a.c.apiName))[0]
					if (best) this.pickCarousel(pickerId, best.i)
				} else if (s.gameTime >= s.pickEndsAt) {
					// 超时随机
					const idx = this.rng.int(s.carousel.length)
					if (s.carousel.length > 0) this.pickCarousel(pickerId, idx)
					else this.nextPicker()
				}
			}
			return
		}

		// bot 在 planning 期间行动
		if (s.phase === 'planning') {
			for (const p of s.players) {
				if (!p.isBot || !p.alive) continue
				const offers = s.augmentOffers.get(p.id)
				if (offers) this.pickAugment(p.id, offers[this.rng.int(offers.length)])
				const at = s.botActAt.get(p.id) ?? 0
				if (s.gameTime >= at) {
					aiTakeTurn(this, p, this.rng)
					s.botActAt.set(p.id, s.gameTime + 4000 + this.rng.next() * 8000)
				}
			}
		}

		if (s.gameTime >= s.phaseEndsAt) {
			if (s.phase === 'planning') this.startCombat()
			else if (s.phase === 'combat') this.endCombat()
		}
	}

	// ---------- 内部 ----------

	private alive(pid: number): PlayerState | null {
		const p = this.state.players[pid]
		return p?.alive ? p : null
	}

	private genCarousel(): void {
		const s = this.state
		const aliveCount = s.players.filter((p) => p.alive).length
		const weights = CAROUSEL_COST_WEIGHTS[Math.min(s.stage, 4)] ?? CAROUSEL_COST_WEIGHTS[4]
		const byCost = [1, 2, 3, 4, 5].map((c) => CHAMPIONS.filter((x) => x.cost === c))
		s.carousel = Array.from({ length: aliveCount }, () => {
			let roll = this.rng.next() * weights.reduce((a, b) => a + b, 0)
			let cost = 1
			for (let i = 0; i < 5; i++) {
				roll -= weights[i]
				if (roll <= 0) {
					cost = i + 1
					break
				}
			}
			const pool = byCost[cost - 1]
			return {
				apiName: pool[this.rng.int(pool.length)].apiName,
				item: ITEM_COMPONENTS[this.rng.int(ITEM_COMPONENTS.length)].apiName,
			}
		})
		// 血量最低者优先，同血按 id
		s.carouselQueue = s.players
			.filter((p) => p.alive)
			.sort((a, b) => a.hp - b.hp || a.id - b.id)
			.map((p) => p.id)
		s.currentPickerIndex = 0
		s.pickEndsAt = CAROUSEL_PICK_SECONDS * 1000
		s.phase = 'carousel'
	}

	private nextPicker(): void {
		const s = this.state
		s.currentPickerIndex += 1
		if (s.currentPickerIndex >= s.carouselQueue.length) {
			// 选秀结束：补发本回合收入后进入下一回合
			for (const p of s.players) {
				if (p.alive) p.gold += roundIncome(p, s.stage, s.round, null).total
			}
			this.advanceRound()
			return
		}
		s.pickEndsAt = s.gameTime + CAROUSEL_PICK_SECONDS * 1000
	}

	private grantCarouselUnit(pid: number, slot: CarouselSlot): void {
		const p = this.state.players[pid]
		this.pool.take(slot.apiName)
		const u = createUnit(slot.apiName)
		if (p.itemTray.length < ITEM_TRAY_SIZE) u.items = [slot.item]
		if (!addToBench(p, u)) {
			// 备战席满：直接折现
			p.gold += costOf(slot.apiName)
			this.pool.addBack(slot.apiName, 1)
		}
	}

	/** 1-1 开局遭遇：全员从 ENCOUNTERS 三选一 */
	private genEncounter(): void {
		const s = this.state
		s.phase = 'encounter'
		s.phaseEndsAt = s.gameTime + ENCOUNTER_SECONDS * 1000
		for (const p of s.players) {
			if (p.alive)
				s.augmentOffers.set(
					p.id,
					ENCOUNTERS.map((e) => e.apiName),
				)
		}
	}

	/** 海克斯回合：从池中随机 3 个（排除已选） */
	private genAugmentOffers(): void {
		const s = this.state
		for (const p of s.players) {
			if (!p.alive) continue
			const pool = AUGMENTS.filter((a) => !p.augments.includes(a.apiName))
			const picks = this.rng.shuffle(pool.map((a) => a.apiName)).slice(0, 3)
			s.augmentOffers.set(p.id, picks)
		}
	}

	private startPlanning(): void {
		const s = this.state
		s.phase = 'planning'
		s.phaseEndsAt = s.gameTime + PLANNING_SECONDS * 1000
		// PvE 回合：预生成野怪波次，备战阶段即可见
		s.pveWave = roundType(s.stage, s.round) === 'pve' ? this.buildPveWave() : null
		if (isAugmentRound(s.stage, s.round)) this.genAugmentOffers()
		for (const p of s.players) {
			if (!p.alive) continue
			applyXp(p, PASSIVE_XP)
			// 阶段开始金币（贪财等）
			if (s.round === 1) {
				p.gold += p.augments
					.flatMap((a) => AUGMENT_BY_API.get(a)?.effects ?? [])
					.filter((e) => e.kind === 'stageGold')
					.reduce((sum, e) => sum + (e as { amount: number }).amount, 0)
			}
			p.freeRerolls = p.augments
				.flatMap((a) => AUGMENT_BY_API.get(a)?.effects ?? [])
				.filter((e) => e.kind === 'freeRerolls')
				.reduce((sum, e) => sum + (e as { perRound: number }).perRound, 0)
			if (p.shopLocked) p.shopLocked = false
			else p.shop = this.pool.rollShop(p.level, this.rng)
			if (p.isBot) s.botActAt.set(p.id, s.gameTime + this.rng.next() * 6000)
		}
	}

	private startCombat(): void {
		const s = this.state
		s.phase = 'combat'
		s.combatStartAt = s.gameTime
		s.combats = new Map()
		// 备战结束仍未选的海克斯：强制随机补选
		for (const [pid, offers] of [...s.augmentOffers]) {
			this.pickAugment(pid, offers[this.rng.int(offers.length)])
		}
		const alive = s.players.filter((p) => p.alive)

		if (roundType(s.stage, s.round) === 'pve') {
			const monsters = s.pveWave ?? this.buildPveWave()
			for (const p of alive) {
				const input = this.toCombatInput(p)
				const result = simulateCombat(input, monsters, {
					rng: this.rng,
					traitTagsA: this.traitTagsOf(p),
					recordEvents: !p.isBot || p.id === 0,
				})
				s.combats.set(p.id, {
					opponentId: -1,
					opponentName: MONSTER_BY_API.get(monsters[0]?.apiName ?? '')?.name ?? '野怪',
					isGhost: false,
					isPvE: true,
					playerSide: 'A',
					result,
					inputsA: input,
					inputsB: monsters,
				})
			}
		} else {
			// 随机配对，避免连续撞同一对手；奇数时一人打镜像
			const order = this.rng.shuffle(alive.map((p) => p.id))
			const paired = new Set<number>()
			for (let i = 0; i < order.length; i++) {
				const a = order[i]
				if (paired.has(a)) continue
				let b = -1
				for (let j = i + 1; j < order.length; j++) {
					const cand = order[j]
					if (!paired.has(cand) && cand !== s.players[a].lastOpponentId) {
						b = cand
						break
					}
				}
				if (b === -1) {
					b = order.slice(i + 1).find((cand) => !paired.has(cand)) ?? -1
				}
				paired.add(a)
				if (b === -1) {
					// 镜像局：与随机存活者的复制打，结果不影响对方
					const ghost = alive.find((p) => p.id !== a)
					if (!ghost) continue
					this.runPvp(a, ghost.id, true)
					continue
				}
				paired.add(b)
				this.runPvp(a, b, false)
			}
		}

		const maxDuration = Math.max(...[...s.combats.values()].map((c) => c.result.durationMs), 0)
		s.phaseEndsAt = s.gameTime + maxDuration + COMBAT_BUFFER_SECONDS * 1000
	}

	private runPvp(aId: number, bId: number, isGhost: boolean): void {
		const s = this.state
		const pa = s.players[aId]
		const pb = s.players[bId]
		const inputsA = this.toCombatInput(pa)
		const inputsB = this.toCombatInput(pb)
		const result = simulateCombat(inputsA, inputsB, {
			rng: this.rng,
			traitTagsA: this.traitTagsOf(pa),
			traitTagsB: this.traitTagsOf(pb),
			recordEvents: !pa.isBot || !pb.isBot,
		})
		s.combats.set(aId, {
			opponentId: bId,
			opponentName: pb.name,
			isGhost,
			isPvE: false,
			playerSide: 'A',
			result,
			inputsA,
			inputsB,
		})
		if (!isGhost) {
			s.combats.set(bId, {
				opponentId: aId,
				opponentName: pa.name,
				isGhost: false,
				isPvE: false,
				playerSide: 'B',
				result,
				inputsA,
				inputsB,
			})
		}
		pa.lastOpponentId = bId
		pb.lastOpponentId = aId
	}

	private endCombat(): void {
		const s = this.state
		const eliminated: PlayerState[] = []
		for (const p of s.players) {
			if (!p.alive) continue
			const rec = s.combats.get(p.id)
			if (!rec) continue
			const r = rec.result
			const oppSurvivors = rec.playerSide === 'A' ? r.survivorsB : r.survivorsA
			const won =
				(r.winner === 'A' && rec.playerSide === 'A') || (r.winner === 'B' && rec.playerSide === 'B')

			if (!rec.isPvE) {
				if (r.winner === 'draw') {
					p.streakType = 'none'
					p.streakCount = 0
				} else if (won) {
					p.streakCount = p.streakType === 'win' ? p.streakCount + 1 : 1
					p.streakType = 'win'
				} else {
					p.streakCount = p.streakType === 'loss' ? p.streakCount + 1 : 1
					p.streakType = 'loss'
				}
			}

			const inc = roundIncome(p, s.stage, s.round, rec.isPvE ? null : won)
			p.gold += inc.total

			if (rec.isPvE) {
				// PvE：无论胜负都给掉落，且不掉血（对齐官方规则）
				const drop = PVE_DROPS[`${s.stage}-${s.round}`]
				if (drop) {
					p.gold += drop.gold
					for (let i = 0; i < drop.components && p.itemTray.length < ITEM_TRAY_SIZE; i++) {
						p.itemTray.push(ITEM_COMPONENTS[this.rng.int(ITEM_COMPONENTS.length)].apiName)
					}
				}
			} else if (!won && !rec.isGhost) {
				p.hp -= playerDamage(s.stage, oppSurvivors)
			}

			if (p.hp <= 0) {
				p.hp = 0
				eliminated.push(p)
			}
		}

		// 同回合淘汰：血低者名次靠后
		eliminated.sort((a, b) => a.hp - b.hp)
		let remaining = s.players.filter((p) => p.alive).length
		for (const p of eliminated) {
			p.alive = false
			p.placement = remaining
			remaining -= 1
			// 淘汰者棋子回池
			for (const u of [...p.board, ...p.bench.filter((b) => b !== null)]) {
				this.pool.addBack(u.apiName, 3 ** (u.star - 1))
			}
			p.board = []
			p.bench = p.bench.map(() => null)
		}

		const alivePlayers = s.players.filter((p) => p.alive)
		if (alivePlayers.length === 1) {
			alivePlayers[0].placement = 1
			s.winnerId = alivePlayers[0].id
			s.phase = 'ended'
			return
		}
		if (alivePlayers.length === 0) {
			s.phase = 'ended'
			return
		}
		this.advanceRound()
	}

	private advanceRound(): void {
		const s = this.state
		const maxRounds = s.stage === 1 ? STAGE1_ROUNDS : STAGE_ROUNDS
		if (s.round >= maxRounds) {
			s.stage += 1
			s.round = 1
		} else {
			s.round += 1
		}
		const type = roundType(s.stage, s.round)
		if (type === 'carousel') this.genCarousel()
		else this.startPlanning()
	}

	private toCombatInput(p: PlayerState): CombatUnitInput[] {
		const active = computeActiveTraits(p.board)
		const buffs = p.augments
			.flatMap((a) => AUGMENT_BY_API.get(a)?.effects ?? [])
			.filter((e) => e.kind === 'teamBuff') as {
			adPct?: number
			ap?: number
			hpPct?: number
			asPct?: number
		}[]
		return p.board.map((b) => {
			const stats = applyTraitStats(b, unitStats(b), active)
			for (const buff of buffs) {
				if (buff.adPct) stats.attackDamage = Math.round(stats.attackDamage * (1 + buff.adPct))
				if (buff.ap) stats.abilityPower += buff.ap
				if (buff.hpPct) stats.maxHp = Math.round(stats.maxHp * (1 + buff.hpPct))
				if (buff.asPct) stats.attackSpeed = round2(stats.attackSpeed * (1 + buff.asPct))
			}
			return {
				uid: b.uid,
				apiName: b.apiName,
				star: b.star,
				pos: b.pos,
				stats,
				items: b.items,
			}
		})
	}

	private traitTagsOf(p: PlayerState): Set<string> {
		const tags = new Set<string>()
		for (const a of computeActiveTraits(p.board)) {
			const tag = TRAIT_EFFECTS[a.apiName]?.[a.breakpointIndex]?.customTag
			if (tag) tags.add(tag)
		}
		return tags
	}

	/** 按 stage-round 查野怪波次表；Boss 轮（5-7 起）数值按阶段放大 */
	private buildPveWave(): CombatUnitInput[] {
		const s = this.state
		const scale = pveStatScale(s.stage)
		return pveWaveFor(s.stage, s.round).map((spawn, i) => {
			const def = MONSTER_BY_API.get(spawn.apiName)
			const st = def?.stats
			return {
				uid: `pve-${s.stage}-${s.round}-${i}`,
				apiName: spawn.apiName,
				star: 1 as const,
				pos: { col: spawn.col, row: spawn.row },
				stats: {
					maxHp: Math.round((st?.maxHp ?? 400) * scale),
					attackDamage: Math.round((st?.attackDamage ?? 35) * scale),
					abilityPower: 100,
					attackSpeed: st?.attackSpeed ?? 0.6,
					armor: st?.armor ?? 20,
					magicResist: st?.magicResist ?? 20,
					mana: 9999,
					initialMana: 0,
					range: st?.range ?? 1,
					critChance: 0,
					critMultiplier: 1.4,
					manaRegen: 0,
					damageAmp: 0,
					damageReduction: 0,
					omnivamp: 0,
				},
				items: [],
			}
		})
	}
}

const round2 = (n: number) => Math.round(n * 100) / 100
