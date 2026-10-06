// 游戏主循环：阶段编排（遭遇/选秀/备战/战斗）与玩家操作入口
// 子系统：armory（武器库）/ augmentFlow（海克斯）/ carousel（选秀）/ combatSetup（开战装配）/ traitRoundHooks（羁绊回合钩子）/ playerBuffs（团队增益）
import {
	BENCH_SIZE,
	CAROUSEL_PICK_SECONDS,
	COMBAT_BUFFER_SECONDS,
	ENCOUNTER_SECONDS,
	ITEM_TRAY_SIZE,
	PASSIVE_XP,
	PLANNING_SECONDS,
	PVE_BOSS_CONSUMABLE_ODDS,
	PVE_DROPS,
	SHOP_REFRESH_COST,
	SHOP_SIZE,
	STAGE1_ROUNDS,
	STAGE_ROUNDS,
	STARTING_HP,
	isAugmentRound,
	roundType,
} from '../data/rules'
import { CHAMPIONS, CHAMPION_BY_API, ITEM_BY_API, ITEM_COMPONENTS } from '../data/set18'
import { AUGMENT_BY_API, ENCOUNTERS } from '../data/set18/augments'
import {
	CONSUMABLE_ALPHA_MARK,
	CONSUMABLE_DUPLICATOR,
	CONSUMABLE_LESSER_DUPLICATOR,
	CONSUMABLE_REMOVER,
	CONSUMABLE_REROLLER,
	isConsumable,
} from '../data/set18/consumables'
import { COVEN_TIERS } from '../data/set18/coven'
import { MONSTER_BY_API } from '../data/set18/monsters'
import { aiTakeTurn, autoDeploy } from './ai'
import {
	CRAFTABLE_POOL,
	checkLevelArmories,
	grantRandomEmblem,
	grantStageEmblemChamp,
	openArmory,
	pickArmory as pickArmoryOffer,
	rerollPoolFor,
} from './armory'
import {
	type AugmentDeps,
	applyAugment,
	applyPlanningAugments,
	genAugmentOffers,
	grantCovenReward,
	onBuyBlossom,
	pickTraitArmory,
	rollCovenReward,
	settleAugmentTimers,
	settleRoundHooks,
	syncLuxTraits,
} from './augmentFlow'
import { carouselPickOrder, genCarouselSlots, grantCarouselUnit } from './carousel'
import { simulateCombat } from './combat'
import { buildPveWave, toCombatInput } from './combatSetup'
import { applyXp, buyXp as engineBuyXp, playerDamage, roundIncome } from './economy'
import { CardPool } from './pool'
import { type Rng, makeRng } from './rng'
import { applyTraitShopEffects, settleCombatMetrics, settleTraitCombat } from './traitRoundHooks'
import { computeActiveTraits } from './traits'
import type { GameState, PlayerState } from './types'
import {
	addToBench,
	costOf,
	createUnit,
	dummiesCanEquip,
	equipItem as engineEquipItem,
	sellUnit as engineSellUnit,
	findUnit,
	moveToBench,
	placeOnBoard,
	resetUidSeq,
} from './units'

const BOT_NAMES = ['青钢影', '发条魔灵', '皮城女警', '暴走萝莉', '潮汐海灵', '暮光之眼', '荆棘之兴']

export class GameEngine {
	state: GameState
	private pool: CardPool
	private rng: Rng
	private augDeps: AugmentDeps

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
			ignitedSlots: [],
			riftbeastCombats: 0,
			covenEssence: -1,
			covenCashouts: 0,
			bonusMaxHpFlat: 0,
			maokaiStacks: 0,
			rivalTakedowns: 0,
			armory: null,
			armoryQueue: [],
			augMemo: {},
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
			encounterApi: null,
		}
		this.augDeps = {
			rng: this.rng,
			pool: this.pool,
			grantChampUnit: (p, champApi, star) => this.grantChampUnit(p, champApi, star),
			openArmory: (p, pool, options, source, chain) =>
				openArmory(this.rng, p, pool, options, source, chain),
			grantRandomEmblem: (p, memoKey) => grantRandomEmblem(this.rng, p, memoKey),
			grantStageEmblemChamp: (p, augApi, gold) =>
				grantStageEmblemChamp(this.rng, p, this.state.stage, augApi, gold, (api) =>
					this.grantChampUnit(p, api),
				),
			checkLevelArmories: (p) =>
				checkLevelArmories(this.rng, p, (api, star) => this.grantChampUnit(p, api, star)),
		}
		// 开局必得一个随机 1 费棋子（官方规则）
		const cost1 = CHAMPIONS.filter((c) => c.cost === 1)
		for (const p of players) {
			for (let tries = 0; tries < 10; tries++) {
				const c = cost1[this.rng.int(cost1.length)]
				if (this.pool.take(c.apiName) && addToBench(p, createUnit(c.apiName))) break
				this.pool.addBack(c.apiName, 1)
			}
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
		p.ignitedSlots = p.ignitedSlots.filter((s) => s !== slot)
		addToBench(p, createUnit(apiName))
		onBuyBlossom(p, apiName)
		syncLuxTraits(this.augDeps, p)
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
		// 大刷特刷：每次刷新队伍获得永久生命
		p.bonusMaxHpFlat += (p.augments ?? [])
			.flatMap((a) => AUGMENT_BY_API.get(a)?.effects ?? [])
			.filter((e) => e.kind === 'rerollRamp')
			.reduce((s, e) => s + (e as { hpFlat: number }).hpFlat, 0)
		p.shopLocked = false
		p.ignitedSlots = []
		p.shop = this.pool.rollShop(p.level, this.rng)
		return true
	}

	buyXp(pid: number): boolean {
		const p = this.alive(pid)
		if (!p || this.econBlocked()) return false
		const levelBefore = p.level
		const ok = engineBuyXp(p)
		if (ok) {
			this.applyLevelUpBonuses(p, levelBefore)
			this.augDeps.checkLevelArmories(p)
		}
		return ok
	}

	/** 上进心/大买特买：升级时发放生命与免费刷新（等级武器库另行检查） */
	private applyLevelUpBonuses(p: PlayerState, levelBefore: number): void {
		if (p.level <= levelBefore) return
		for (const a of p.augments) {
			const def = AUGMENT_BY_API.get(a)
			if (!def) continue
			for (const e of def.effects) {
				if (e.kind !== 'levelUpBonus') continue
				if (e.hp) p.hp += e.hp
				const rerolls = (e.rerolls ?? 0) + (e.rerollsPerLevel ?? 0) * p.level
				p.freeRerolls += rerolls
			}
		}
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
		// 训练假人不可出售（官方规则）
		if (MONSTER_BY_API.has(f.apiName)) return false
		// 打捞桶：携带的成装拆分成基础装备（冠冕系/纹章除外）
		const hasSalvage = p.augments.some((a) =>
			AUGMENT_BY_API.get(a)?.effects.some((e) => e.kind === 'salvageSplit'),
		)
		if (hasSalvage) {
			f.items = f.items.flatMap((it) => {
				const def = ITEM_BY_API.get(it)
				return def && def.composition.length === 2 && !def.grantsTrait && !it.includes('Tactician')
					? def.composition
					: [it]
			})
		}
		const gold = engineSellUnit(p, uid)
		if (gold === null) return false
		this.pool.addBack(f.apiName, 3 ** (f.star - 1))
		return true
	}

	equipItem(pid: number, uid: string, itemApi: string): boolean {
		const p = this.alive(pid)
		if (!p || this.state.phase !== 'planning') return false
		if (isConsumable(itemApi)) return this.useConsumable(p, uid, itemApi)
		return engineEquipItem(p, uid, itemApi)
	}

	/** 消耗品：阿尔法印记给峡谷野怪独特增益；拆卸器取下全部装备回装备栏；重铸器取下并同类随机变形（冠冕/腐化装不进重铸池）；复制器生成同星复制体入备战席（次级限 3 费及以下）；假人默认不可携带 */
	private useConsumable(p: PlayerState, uid: string, itemApi: string): boolean {
		const f = findUnit(p, uid)
		if (!f) return false
		if (MONSTER_BY_API.has(f.unit.apiName) && !dummiesCanEquip(p)) return false
		const ti = p.itemTray.indexOf(itemApi)
		if (ti < 0) return false
		if (itemApi === CONSUMABLE_ALPHA_MARK) {
			if (f.unit.alphaMark) return false
			if (!CHAMPION_BY_API.get(f.unit.apiName)?.traits.includes('DA_Riftbeast18')) return false
			p.itemTray.splice(ti, 1)
			f.unit.alphaMark = true
			return true
		}
		// 英雄复制器/次级英雄复制器：复制棋子到备战席（不占卡池名额；次级仅 3 费及以下）
		if (itemApi === CONSUMABLE_DUPLICATOR || itemApi === CONSUMABLE_LESSER_DUPLICATOR) {
			const def = CHAMPION_BY_API.get(f.unit.apiName)
			if (!def) return false
			if (itemApi === CONSUMABLE_LESSER_DUPLICATOR && def.cost > 3) return false
			const copy = createUnit(f.unit.apiName)
			copy.star = f.unit.star
			if (!addToBench(p, copy)) return false
			p.itemTray.splice(ti, 1)
			return true
		}
		if (f.unit.items.length === 0) return false
		p.itemTray.splice(ti, 1)
		const pushTray = (api: string) => {
			if (p.itemTray.length < ITEM_TRAY_SIZE) p.itemTray.push(api)
		}
		if (itemApi === CONSUMABLE_REMOVER) {
			for (const it of f.unit.items) pushTray(it)
		} else {
			for (const it of f.unit.items) {
				const pool = rerollPoolFor(it)
				pushTray(pool[this.rng.int(pool.length)])
			}
		}
		f.unit.items = []
		return true
	}

	pickCarousel(pid: number, slotIndex: number): boolean {
		const s = this.state
		if (s.phase !== 'carousel') return false
		if (s.carouselQueue[s.currentPickerIndex] !== pid) return false
		const slot = s.carousel[slotIndex]
		if (!slot) return false
		s.carousel.splice(slotIndex, 1)
		grantCarouselUnit(this.pool, s.players[pid], slot)
		syncLuxTraits(this.augDeps, s.players[pid])
		this.nextPicker()
		return true
	}

	/** 发棋子入备战席（卡池抽干或备战席满时折现），成功返回 uid */
	private grantChampUnit(p: PlayerState, champApi: string, star = 1): string | null {
		const copies = 3 ** (star - 1)
		for (let i = 0; i < copies; i++) {
			if (!this.pool.take(champApi)) break
		}
		const u = createUnit(champApi)
		u.star = star as typeof u.star
		if (!addToBench(p, u)) {
			p.gold += costOf(champApi) * copies
			return null
		}
		syncLuxTraits(this.augDeps, p)
		return u.uid
	}

	/** 武器库挑选（羁绊库走创世神拉克丝流程，其余见 armory.ts） */
	pickArmory(pid: number, itemApi: string): boolean {
		const p = this.alive(pid)
		if (!p) return false
		if (p.armory?.pool === 'trait') return pickTraitArmory(this.augDeps, p, itemApi)
		return pickArmoryOffer(this.rng, p, itemApi)
	}

	/** 海克斯/遭遇三选一；encounter 与 augment 回合共用 */
	pickAugment(pid: number, apiName: string): boolean {
		const s = this.state
		const offers = s.augmentOffers.get(pid)
		if (!offers || !offers.includes(apiName)) return false
		const p = s.players[pid]
		if (!p?.alive) return false
		s.augmentOffers.delete(pid)
		applyAugment(this.augDeps, p, apiName)
		return true
	}

	/** 魔女精粹兑换：达到当前档位阈值可兑换一次奖励并推进档位 */
	redeemCoven(pid: number): boolean {
		const p = this.alive(pid)
		if (!p || this.econBlocked() || p.covenEssence < 0) return false
		const tier = COVEN_TIERS[p.covenCashouts]
		if (!tier || p.covenEssence < tier.essence) return false
		const reward = rollCovenReward(this.rng, p.covenCashouts)
		if (!reward) return false
		p.covenEssence -= tier.essence
		p.covenCashouts += 1
		grantCovenReward(this.augDeps, p, reward)
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

	// ---------- 推进 ----------

	/** dt 为已按倍速缩放后的毫秒 */
	tick(dtMs: number): void {
		const s = this.state
		if (s.phase === 'ended' || s.phase === 'lobby') return
		s.gameTime += dtMs

		if (s.phase === 'encounter') {
			// 遭遇为公告阶段：无选择，倒计时结束直接进 1-2
			if (s.gameTime >= s.phaseEndsAt) this.advanceRound()
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
				if (p.armory) this.pickArmory(p.id, p.armory.options[this.rng.int(p.armory.options.length)])
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
		s.carousel = genCarouselSlots(this.rng, s.stage, s.players.filter((p) => p.alive).length)
		s.carouselQueue = carouselPickOrder(s.players)
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

	/** 1-1 开局遭遇：全场随机一个直接生效（对齐官方：遭遇不可自选） */
	private genEncounter(): void {
		const s = this.state
		s.phase = 'encounter'
		s.phaseEndsAt = s.gameTime + ENCOUNTER_SECONDS * 1000
		const enc = ENCOUNTERS[this.rng.int(ENCOUNTERS.length)]
		s.encounterApi = enc.apiName
		for (const p of s.players) {
			if (p.alive) applyAugment(this.augDeps, p, enc.apiName)
		}
	}

	private startPlanning(): void {
		const s = this.state
		s.phase = 'planning'
		s.phaseEndsAt = s.gameTime + PLANNING_SECONDS * 1000
		// PvE 回合：预生成野怪波次，备战阶段即可见
		s.pveWave = roundType(s.stage, s.round) === 'pve' ? buildPveWave(s.stage, s.round) : null
		if (isAugmentRound(s.stage, s.round)) s.augmentOffers = genAugmentOffers(this.rng, s.players)
		for (const p of s.players) {
			if (!p.alive) continue
			const levelBefore = p.level
			applyXp(p, PASSIVE_XP)
			this.applyLevelUpBonuses(p, levelBefore)
			// 海克斯周期钩子：阶段开始发放 / 金色炊具 / 等级武器库 / 免费刷新
			applyPlanningAugments(this.augDeps, p, s.round === 1, roundType(s.stage, s.round) === 'pvp')
			if (p.shopLocked) p.shopLocked = false
			else {
				p.ignitedSlots = []
				p.shop = this.pool.rollShop(p.level, this.rng)
			}
			applyTraitShopEffects(this.rng, this.pool, p)
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
		// 未选的武器库同样强制补选（含排队与套娃链）
		for (const p of alive) {
			while (p.armory)
				this.pickArmory(p.id, p.armory.options[this.rng.int(p.armory.options.length)])
		}
		// 开战前自动补位：备战席棋子按价值填满人口（含冠冕加成）
		for (const p of alive) autoDeploy(p, this.rng)

		if (roundType(s.stage, s.round) === 'pve') {
			const monsters = s.pveWave ?? buildPveWave(s.stage, s.round)
			for (const p of alive) {
				const input = toCombatInput(p, s.stage, this.rng)
				const result = simulateCombat(input, monsters, {
					rng: this.rng,
					traitsA: computeActiveTraits(p.board),
					recordEvents: !p.isBot || p.id === 0,
					stage: s.stage,
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
		const inputsA = toCombatInput(pa, s.stage, this.rng)
		const inputsB = toCombatInput(pb, s.stage, this.rng)
		const result = simulateCombat(inputsA, inputsB, {
			rng: this.rng,
			traitsA: computeActiveTraits(pa.board),
			traitsB: computeActiveTraits(pb.board),
			recordEvents: !pa.isBot || !pb.isBot,
			stage: s.stage,
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
			const hpBefore = p.hp
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

			// 羁绊结算（峡谷野怪计数/魔女精粹）+ 战斗插件指标折现（茂凯/雷恩加尔/皮克斯/假人）
			settleTraitCombat(p, rec)
			settleCombatMetrics(p, rec)

			if (rec.isPvE) {
				// PvE：无论胜负都给掉落，且不掉血（对齐官方规则）
				const drop = PVE_DROPS[`${s.stage}-${s.round}`]
				if (drop) {
					p.gold += drop.gold
					for (let i = 0; i < drop.components && p.itemTray.length < ITEM_TRAY_SIZE; i++) {
						p.itemTray.push(ITEM_COMPONENTS[this.rng.int(ITEM_COMPONENTS.length)].apiName)
					}
					// Boss 轮（x-7）额外概率掉消耗品（概率配置见 rules.ts）
					if (s.round === STAGE_ROUNDS && p.itemTray.length < ITEM_TRAY_SIZE) {
						const roll = this.rng.next()
						if (roll < PVE_BOSS_CONSUMABLE_ODDS.remover) p.itemTray.push(CONSUMABLE_REMOVER)
						else if (roll < PVE_BOSS_CONSUMABLE_ODDS.remover + PVE_BOSS_CONSUMABLE_ODDS.reroller)
							p.itemTray.push(CONSUMABLE_REROLLER)
					}
				}
			} else if (!won && !rec.isGhost) {
				p.hp -= playerDamage(s.stage, oppSurvivors)
			}

			// 海克斯 PvP 回合倒数（锻炉/打捞桶/蔓延之根）与降血阈值（神力天铸）
			settleAugmentTimers(this.augDeps, p, rec, hpBefore)
			// 海克斯回合结算钩子：清晰头脑/纷乱头脑/物尽其用/耐心学习/打气叠层/战争财宝
			const enemyTotal = rec.playerSide === 'A' ? rec.inputsB.length : rec.inputsA.length
			const enemyLeft = rec.playerSide === 'A' ? r.survivorsB : r.survivorsA
			settleRoundHooks(this.augDeps, p, rec.isPvE ? null : won, !rec.isPvE, enemyTotal - enemyLeft)

			// 征战之路：对敌方小小英雄造成伤害累计，达标发宝箱
			if (!rec.isPvE && !rec.isGhost && won) {
				const dealt = playerDamage(s.stage, oppSurvivors)
				for (const a of p.augments) {
					const def = AUGMENT_BY_API.get(a)
					if (!def) continue
					for (const e of def.effects) {
						if (e.kind !== 'playerDamageQuest' || p.augMemo[`${a}.done`]) continue
						const cur = Number(p.augMemo[`${a}.pd`] ?? 0) + dealt
						if (cur < e.target) {
							p.augMemo[`${a}.pd`] = cur
							continue
						}
						p.augMemo[`${a}.done`] = 1
						const highCost = CHAMPIONS.filter((c) => c.cost >= e.minCost)
						for (let i = 0; i < e.champCount && highCost.length > 0; i++) {
							this.augDeps.grantChampUnit(p, highCost[this.rng.int(highCost.length)].apiName)
						}
						for (let i = 0; i < e.itemCount && p.itemTray.length < ITEM_TRAY_SIZE; i++) {
							p.itemTray.push(CRAFTABLE_POOL[this.rng.int(CRAFTABLE_POOL.length)].apiName)
						}
					}
				}
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
}
