// 海克斯流程：应用（三选一/遭遇）、候选生成、备战/战斗结算的周期钩子、购买钩子、魔女精粹奖励
import { ITEM_TRAY_SIZE } from '../data/rules'
import { CHAMPIONS, CHAMPION_BY_API, ITEM_BY_API, ITEM_COMPONENTS } from '../data/set18'
import {
	AUGMENTS,
	AUGMENT_BY_API,
	AUGMENT_TIER_ODDS,
	type ArmoryChain,
	type ArmoryPool,
} from '../data/set18/augments'
import {
	CONSUMABLE_DUPLICATOR,
	CONSUMABLE_LESSER_DUPLICATOR,
	CONSUMABLE_REMOVER,
	CONSUMABLE_REROLLER,
	isConsumable,
} from '../data/set18/consumables'
import { COVEN_TIERS, type CovenReward } from '../data/set18/coven'
import { MONSTER_BY_API } from '../data/set18/monsters'
import { ARTIFACT_POOL, CRAFTABLE_POOL, EMBLEM_POOL, RADIANT_POOL, rerollPoolFor } from './armory'
import { applyXp } from './economy'
import { hexDistance } from './hex'
import { isSpatFamily } from './items'
import { LUX_BASE, isLux } from './lux'
import type { CardPool } from './pool'
import type { Rng } from './rng'
import type { CombatRecord, PlayerState, UnitInstance } from './types'
import { addToBench, costOf, createUnit, findUnit, unitStats } from './units'

/** 假人化「非坦克」判定：四类坦克羁绊之外才算非坦克 */
const TANK_TRAITS = new Set([
	'DA_18_Vanguard',
	'DA_18_Brawler',
	'DA_18_Defender',
	'DA_Juggernaut18',
])

/** 海克斯流程需要的宿主能力（由 GameEngine 绑定注入） */
export interface AugmentDeps {
	rng: Rng
	pool: CardPool
	/** 发棋子入备战席（折现返回 null，成功返回 uid） */
	grantChampUnit: (p: PlayerState, champApi: string, star?: number) => string | null
	openArmory: (
		p: PlayerState,
		pool: ArmoryPool,
		options?: number,
		source?: string,
		chain?: ArmoryChain,
	) => void
	grantRandomEmblem: (p: PlayerState, memoKey?: string) => void
	grantStageEmblemChamp: (p: PlayerState, augApi: string, gold: number) => void
	checkLevelArmories: (p: PlayerState) => void
}

const effectsOf = (p: PlayerState) =>
	p.augments.flatMap((a) => AUGMENT_BY_API.get(a)?.effects ?? [])

const pushTray = (p: PlayerState, api: string) => {
	if (p.itemTray.length < ITEM_TRAY_SIZE) p.itemTray.push(api)
}

/** 应用海克斯/遭遇效果（遭遇也走同一管道，对齐官方「遭遇=全员共享的海克斯」） */
export function applyAugment(deps: AugmentDeps, p: PlayerState, apiName: string): void {
	const def = AUGMENT_BY_API.get(apiName)
	if (!def) return
	p.augments.push(apiName)
	const { rng, pool } = deps
	const grantChamp = (champApi: string, star = 1) => deps.grantChampUnit(p, champApi, star)
	for (const e of def.effects) {
		switch (e.kind) {
			case 'goldNow':
				p.gold += e.amount
				break
			case 'goldCoinFlip':
				if (rng.next() < 0.5) p.gold += e.amount
				break
			case 'xpNow':
				applyXp(p, e.amount)
				break
			case 'components':
				for (let i = 0; i < e.count; i++) {
					pushTray(p, ITEM_COMPONENTS[rng.int(ITEM_COMPONENTS.length)].apiName)
				}
				break
			case 'componentsSame': {
				const api = ITEM_COMPONENTS[rng.int(ITEM_COMPONENTS.length)].apiName
				for (let i = 0; i < e.count; i++) pushTray(p, api)
				break
			}
			case 'consumablesNow':
				for (let i = 0; i < (e.removers ?? 0); i++) pushTray(p, CONSUMABLE_REMOVER)
				for (let i = 0; i < (e.rerollers ?? 0); i++) pushTray(p, CONSUMABLE_REROLLER)
				for (let i = 0; i < (e.duplicators ?? 0); i++) pushTray(p, CONSUMABLE_DUPLICATOR)
				for (let i = 0; i < (e.lesserDuplicators ?? 0); i++)
					pushTray(p, CONSUMABLE_LESSER_DUPLICATOR)
				break
			case 'rerollsNow':
				p.freeRerolls += e.count
				break
			case 'streakWin':
				p.streakType = 'win'
				p.streakCount = e.count
				break
			case 'randomChamps': {
				const champPool = CHAMPIONS.filter((c) => c.cost === e.cost)
				for (let i = 0; i < e.count && champPool.length > 0; i++) {
					grantChamp(champPool[rng.int(champPool.length)].apiName, e.star ?? 1)
				}
				break
			}
			case 'namedChamps':
				for (const c of e.champs) {
					const champDef = CHAMPIONS.find((x) => x.name === c.name)
					if (!champDef) continue
					for (let i = 0; i < c.count; i++) grantChamp(champDef.apiName)
				}
				break
			case 'randomAugment': {
				// 命运系列：随机获得一个同品质海克斯（不再抽到命运，避免连锁）
				const augPool = AUGMENTS.filter(
					(a) =>
						a.tier === e.tier &&
						!p.augments.includes(a.apiName) &&
						!a.effects.some((x) => x.kind === 'randomAugment'),
				)
				if (augPool.length > 0) applyAugment(deps, p, augPool[rng.int(augPool.length)].apiName)
				break
			}
			case 'unitWithItem': {
				const champPool = CHAMPIONS.filter((c) => c.cost === e.cost)
				const champApi = champPool[rng.int(champPool.length)].apiName
				const u = createUnit(champApi)
				if (p.itemTray.length < ITEM_TRAY_SIZE) {
					u.items = [ITEM_COMPONENTS[rng.int(ITEM_COMPONENTS.length)].apiName]
				}
				if (!pool.take(champApi) || !addToBench(p, u)) {
					p.gold += e.cost
					pool.addBack(champApi, 1)
				}
				break
			}
			case 'armoryNow':
				deps.openArmory(p, e.pool, e.options ?? 4, def.apiName, e.chain)
				break
			case 'armoryPerRounds':
			case 'armoryAfterRounds':
			case 'delayRandom':
				// PvP 回合倒数（settleAugmentTimers 结算；0 = 一次性已发放）
				p.augMemo[def.apiName] = e.rounds
				if (e.kind === 'delayRandom' && e.times) p.augMemo[`${def.apiName}.times`] = e.times
				break
			case 'armoryAtLevels':
				deps.checkLevelArmories(p)
				break
			case 'randomArtifacts':
				for (let i = 0; i < e.count; i++) pushTray(p, ARTIFACT_POOL[rng.int(ARTIFACT_POOL.length)])
				break
			case 'randomRadiant':
				for (let i = 0; i < e.count; i++) pushTray(p, RADIANT_POOL[rng.int(RADIANT_POOL.length)])
				break
			case 'coinFlipArmory':
				// 黄金赌约：正面=光明武器库 5 选 1（幸运装备宝箱的净效果），反面=N 个成装锻造器
				p.gold += e.gold
				if (rng.next() < 0.5) deps.openArmory(p, 'radiant', 5, def.apiName)
				else for (let i = 0; i < e.tailsCount; i++) deps.openArmory(p, e.tailsPool, 4, def.apiName)
				break
			case 'luxCreator':
				// 创世神：选定羁绊后由 pickTraitArmory 补发拉克丝本体+朔极之矛
				p.augMemo.luxPendingUid = '__creator__'
				deps.openArmory(p, 'trait', 3, def.apiName)
				break
			case 'dummify': {
				let totalHp = 0
				const lost = [...p.board, ...p.bench.filter((b): b is UnitInstance => b !== null)]
				for (const u of lost) {
					totalHp += unitStats(u).maxHp
					if (!MONSTER_BY_API.has(u.apiName)) pool.addBack(u.apiName, 3 ** (u.star - 1))
					for (const it of u.items) pushTray(p, it)
				}
				p.board = []
				p.bench = p.bench.map(() => null)
				const dummy = createUnit('TFT_TrainingDummy')
				dummy.hpOverride = Math.round(totalHp * e.hpPct)
				addToBench(p, dummy)
				const cost2 = CHAMPIONS.filter((c) => c.cost === 2)
				const nonTank = cost2.filter((c) => !c.traits.some((t) => TANK_TRAITS.has(t)))
				const pool2 = nonTank.length > 0 ? nonTank : cost2
				if (pool2.length > 0) deps.grantChampUnit(p, pool2[rng.int(pool2.length)].apiName, 2)
				break
			}
			case 'randomCompleted':
				for (let i = 0; i < e.count; i++)
					pushTray(p, CRAFTABLE_POOL[rng.int(CRAFTABLE_POOL.length)].apiName)
				break
			case 'randomEmblems':
				for (let i = 0; i < e.count; i++) deps.grantRandomEmblem(p, def.apiName)
				break
			case 'namedItems':
				for (const api of e.apiNames) pushTray(p, api)
				break
			case 'dummyNow':
				for (let i = 0; i < e.count; i++)
					addToBench(p, createUnit(e.big ? 'DA_TheTowerDummy' : 'TFT_TrainingDummy'))
				break
			case 'champWithEmblem': {
				const champPool = CHAMPIONS.filter((c) => c.cost === e.cost)
				if (champPool.length === 0) break
				const champDef = champPool[rng.int(champPool.length)]
				grantChamp(champDef.apiName, e.star ?? 1)
				const emblems = EMBLEM_POOL.filter((api) =>
					champDef.traits.includes(ITEM_BY_API.get(api)?.grantsTrait ?? ''),
				)
				if (emblems.length > 0) pushTray(p, emblems[rng.int(emblems.length)])
				break
			}
			case 'stageEmblemChamp':
				deps.grantStageEmblemChamp(p, def.apiName, e.gold)
				break
			default:
				break
		}
	}
}

/** 拉克丝羁绊库选定：__creator__（创世神）发拉克丝本体+朔极之矛；否则给待选拉克丝补选羁绊 */
export function pickTraitArmory(deps: AugmentDeps, p: PlayerState, traitApi: string): boolean {
	if (p.armory?.pool !== 'trait' || !p.armory.options.includes(traitApi)) return false
	const pending = p.augMemo.luxPendingUid
	if (pending === '__creator__') {
		const uid = deps.grantChampUnit(p, LUX_BASE)
		if (uid) {
			const f = findUnit(p, uid)
			if (f) f.unit.chosenTrait = traitApi
		}
		pushTray(p, 'DA_SpearOfShojin')
	} else if (typeof pending === 'string') {
		const f = findUnit(p, pending)
		if (f) f.unit.chosenTrait = traitApi
	}
	// biome-ignore lint/performance/noDelete: augMemo 类型为 number|string，需真正移除键
	delete p.augMemo.luxPendingUid
	p.armory = p.armoryQueue.shift() ?? null
	syncLuxTraits(deps, p)
	return true
}

/** 拉克丝羁绊同步：已选的把 chosenTrait 传播给未选的；新拿到拉克丝且无待处理选择时开羁绊库 */
export function syncLuxTraits(deps: AugmentDeps, p: PlayerState): void {
	const luxes = [...p.board, ...p.bench.filter((b): b is UnitInstance => b !== null)].filter((u) =>
		isLux(u.apiName),
	)
	if (luxes.length === 0) return
	const chosen = luxes.find((u) => u.chosenTrait)?.chosenTrait
	if (chosen) {
		for (const u of luxes) u.chosenTrait = chosen
		return
	}
	if (!p.augMemo.luxPendingUid && !p.armory) {
		p.augMemo.luxPendingUid = luxes[0].uid
		deps.openArmory(p, 'trait', 3)
	}
}

/** 海克斯回合：全员统一品质（对齐官方），再从该品质池各抽 3 个（排除已选） */
export function genAugmentOffers(rng: Rng, players: PlayerState[]): Map<number, string[]> {
	let roll = rng.next() * AUGMENT_TIER_ODDS.reduce((sum, o) => sum + o.weight, 0)
	let tier: 1 | 2 | 3 = 2
	for (const o of AUGMENT_TIER_ODDS) {
		roll -= o.weight
		if (roll <= 0) {
			tier = o.tier
			break
		}
	}
	const offers = new Map<number, string[]>()
	for (const p of players) {
		if (!p.alive) continue
		const unpicked = AUGMENTS.filter((a) => !p.augments.includes(a.apiName))
		const tierPool = unpicked.filter((a) => a.tier === tier)
		// 该品质余量不足 3 个时用其余品质补齐
		const fills = rng.shuffle(unpicked.filter((a) => a.tier !== tier).map((a) => a.apiName))
		const picks = rng.shuffle(tierPool.map((a) => a.apiName))
		while (picks.length < 3 && fills.length > 0) picks.push(fills.pop() as string)
		offers.set(p.id, picks.slice(0, 3))
	}
	return offers
}

/** 备战开始的海克斯钩子：阶段开始发放（贪财/灵活摇摆/硬性承诺）+ 潘朵拉变形 + 金色炊具 + 等级武器库 + 免费刷新重算 */
export function applyPlanningAugments(
	deps: AugmentDeps,
	p: PlayerState,
	isStageStart: boolean,
): void {
	const effects = effectsOf(p)
	if (isStageStart) {
		p.gold += effects
			.filter((e) => e.kind === 'stageGold')
			.reduce((sum, e) => sum + (e as { amount: number }).amount, 0)
		for (const a of p.augments) {
			const def = AUGMENT_BY_API.get(a)
			if (!def) continue
			for (const e of def.effects) {
				if (e.kind === 'stageEmblem') deps.grantRandomEmblem(p, a)
				else if (e.kind === 'stageEmblemChamp') deps.grantStageEmblemChamp(p, a, e.gold)
			}
		}
	}
	// 潘朵拉的装备：装备栏每回合同类随机变形（消耗品/铲锅系除外，对齐官方排除规则）
	if (effects.some((e) => e.kind === 'pandoraTray')) {
		p.itemTray = p.itemTray.map((it) => {
			if (isConsumable(it) || isSpatFamily(it)) return it
			const pool = rerollPoolFor(it)
			return pool[deps.rng.int(pool.length)]
		})
	}
	// 金色炊具：铲锅系携带者为最近的友军提供永久生命
	const spatHp = effects
		.filter((e) => e.kind === 'roundStartSpatHp')
		.reduce((sum, e) => sum + (e as { amount: number }).amount, 0)
	if (spatHp > 0) {
		for (const holder of p.board.filter((u) => u.items.some(isSpatFamily))) {
			const others = p.board.filter((u) => u.uid !== holder.uid)
			if (others.length === 0) continue
			const nearest = [...others].sort(
				(a, b) =>
					hexDistance(holder.pos, a.pos) - hexDistance(holder.pos, b.pos) ||
					a.uid.localeCompare(b.uid),
			)[0]
			nearest.bonusHpFlat = (nearest.bonusHpFlat ?? 0) + spatHp
		}
	}
	deps.checkLevelArmories(p)
	p.freeRerolls = effects
		.filter((e) => e.kind === 'freeRerolls')
		.reduce((sum, e) => sum + (e as { perRound: number }).perRound, 0)
}

/** 战斗结算的海克斯钩子（仅 PvP）：锻炉/打捞桶/蔓延之根回合倒数 + 神力天铸降血阈值 */
export function settleAugmentTimers(
	deps: AugmentDeps,
	p: PlayerState,
	rec: CombatRecord,
	hpBefore: number,
): void {
	if (rec.isPvE) return
	const { rng } = deps
	for (const a of p.augments) {
		const def = AUGMENT_BY_API.get(a)
		if (!def) continue
		for (const e of def.effects) {
			if (e.kind === 'armoryPerRounds' || e.kind === 'armoryAfterRounds') {
				const left = typeof p.augMemo[a] === 'number' ? (p.augMemo[a] as number) : e.rounds
				if (left <= 0) continue
				if (left === 1) {
					deps.openArmory(p, e.pool, 4, a)
					p.augMemo[a] = e.kind === 'armoryPerRounds' ? e.rounds : 0
				} else p.augMemo[a] = left - 1
			} else if (e.kind === 'delayRandom') {
				const left = typeof p.augMemo[a] === 'number' ? (p.augMemo[a] as number) : e.rounds
				if (left <= 0) continue
				if (left === 1) {
					if (e.gold) p.gold += e.gold
					if (e.xp) applyXp(p, e.xp)
					for (const api of e.items ?? []) pushTray(p, api)
					for (let i = 0; i < (e.duplicators ?? 0); i++) pushTray(p, CONSUMABLE_DUPLICATOR)
					for (let i = 0; i < (e.lesserDuplicators ?? 0); i++)
						pushTray(p, CONSUMABLE_LESSER_DUPLICATOR)
					for (const c of e.champs ?? []) {
						const champPool = CHAMPIONS.filter((x) => x.cost === c.cost)
						for (let i = 0; i < c.count && champPool.length > 0; i++) {
							deps.grantChampUnit(p, champPool[rng.int(champPool.length)].apiName, c.star ?? 1)
						}
					}
					for (let i = 0; i < (e.artifacts ?? 0); i++)
						pushTray(p, ARTIFACT_POOL[rng.int(ARTIFACT_POOL.length)])
					for (let i = 0; i < (e.completed ?? 0); i++)
						pushTray(p, CRAFTABLE_POOL[rng.int(CRAFTABLE_POOL.length)].apiName)
					for (let i = 0; i < (e.components ?? 0); i++)
						pushTray(p, ITEM_COMPONENTS[rng.int(ITEM_COMPONENTS.length)].apiName)
					for (let i = 0; i < (e.emblems ?? 0); i++) deps.grantRandomEmblem(p)
					const timesKey = `${a}.times`
					const timesLeft =
						typeof p.augMemo[timesKey] === 'number' ? (p.augMemo[timesKey] as number) : null
					if (timesLeft !== null) {
						p.augMemo[timesKey] = timesLeft - 1
						p.augMemo[a] = e.repeat && timesLeft > 1 ? e.rounds : 0
					} else p.augMemo[a] = e.repeat ? e.rounds : 0
				} else p.augMemo[a] = left - 1
			} else if (e.kind === 'hpThresholdItems') {
				const doneKey = `${a}.hpDone`
				if (p.augMemo[doneKey] || hpBefore <= e.hp || p.hp > e.hp || p.hp <= 0) continue
				p.augMemo[doneKey] = 1
				for (let i = 0; i < (e.artifacts ?? 0); i++)
					pushTray(p, ARTIFACT_POOL[rng.int(ARTIFACT_POOL.length)])
				for (let i = 0; i < (e.completed ?? 0); i++)
					pushTray(p, CRAFTABLE_POOL[rng.int(CRAFTABLE_POOL.length)].apiName)
				for (let i = 0; i < (e.components ?? 0); i++)
					pushTray(p, ITEM_COMPONENTS[rng.int(ITEM_COMPONENTS.length)].apiName)
			}
		}
	}
}

/** 仙灵报恩/残留魔力：购买【自然仙灵】(灵魂莲华)棋子触发 */
export function onBuyBlossom(p: PlayerState, champApi: string): void {
	if (!CHAMPION_BY_API.get(champApi)?.traits.includes('DA_18_Blossom')) return
	for (const e of effectsOf(p)) {
		if (e.kind !== 'onBuyBlossom') continue
		if (e.gold) p.gold += e.gold
		if (e.hpFlat) p.bonusMaxHpFlat += e.hpFlat
	}
}

/** 魔女精粹兑换：摇当前档位奖励（不校验不扣费，由调用方处理） */
export function rollCovenReward(rng: Rng, cashouts: number): CovenReward | null {
	const tier = COVEN_TIERS[cashouts]
	if (!tier) return null
	let roll = rng.next() * tier.options.reduce((sum, o) => sum + o.weight, 0)
	for (const o of tier.options) {
		roll -= o.weight
		if (roll <= 0) return o.reward
	}
	return tier.options[0].reward
}

/** 魔女奖励发放：金币/散件/成装/消耗品/指定与随机棋子（卡池抽干或备战席满折现） */
export function grantCovenReward(deps: AugmentDeps, p: PlayerState, r: CovenReward): void {
	const { rng, pool } = deps
	if (r.gold) p.gold += r.gold
	for (let i = 0; i < (r.components ?? 0); i++) {
		pushTray(p, ITEM_COMPONENTS[rng.int(ITEM_COMPONENTS.length)].apiName)
	}
	for (let i = 0; i < (r.crafted ?? 0); i++) {
		pushTray(p, CRAFTABLE_POOL[rng.int(CRAFTABLE_POOL.length)].apiName)
	}
	for (let i = 0; i < (r.removers ?? 0); i++) pushTray(p, CONSUMABLE_REMOVER)
	for (let i = 0; i < (r.rerollers ?? 0); i++) pushTray(p, CONSUMABLE_REROLLER)
	const grantChamp = (apiName: string) => {
		if (pool.take(apiName)) {
			if (addToBench(p, createUnit(apiName))) return
			pool.addBack(apiName, 1)
		}
		p.gold += costOf(apiName)
	}
	for (const c of r.champs ?? []) {
		const def = CHAMPIONS.find((x) => x.name === c.name)
		if (!def) continue
		for (let i = 0; i < c.count; i++) grantChamp(def.apiName)
	}
	for (const rc of r.randomCost ?? []) {
		const champPool = CHAMPIONS.filter((x) => x.cost === rc.cost)
		for (let i = 0; i < rc.count && champPool.length > 0; i++) {
			grantChamp(champPool[rng.int(champPool.length)].apiName)
		}
	}
}
