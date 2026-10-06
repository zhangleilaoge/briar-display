// 羁绊的回合级钩子：备战商店机制（印记/占领/引燃）+ 战斗结算（计数/精粹/插件金币指标）
import { ITEM_TRAY_SIZE, SHOP_SIZE } from '../data/rules'
import { CHAMPIONS, CHAMPION_BY_API, TRAIT_BY_API } from '../data/set18'
import { AUGMENT_BY_API } from '../data/set18/augments'
import { CONSUMABLE_ALPHA_MARK } from '../data/set18/consumables'
import { FAE_PIXIE_GOLD } from './plugins/traits/auras'
import { RIVAL_TAKEDOWN_GOLD } from './plugins/traits/economy'
import type { CardPool } from './pool'
import type { Rng } from './rng'
import { computeActiveTraits } from './traits'
import type { CombatRecord, PlayerState } from './types'
import { costOf } from './units'

/** 备战开始时的羁绊商店机制：峡谷野怪印记/商店占领 + 地狱火引燃 + 魔女精粹初始化 */
export function applyTraitShopEffects(rng: Rng, pool: CardPool, p: PlayerState): void {
	const active = computeActiveTraits(p.board)
	const rb = active.find((t) => t.apiName === 'DA_Riftbeast18')
	if (rb) {
		// (3) 阿尔法印记：补发至可标记上限（欧米茄之怪可标记第二个）
		const limit =
			1 +
			p.augments
				.flatMap((a) => AUGMENT_BY_API.get(a)?.effects ?? [])
				.filter((e) => e.kind === 'alphaMarkExtra')
				.reduce((sum, e) => sum + (e as { count: number }).count, 0)
		const markedCount =
			p.board.filter((u) => u.alphaMark).length +
			p.bench.filter((u) => u?.alphaMark).length +
			p.itemTray.filter((i) => i === CONSUMABLE_ALPHA_MARK).length
		for (let i = markedCount; i < limit && p.itemTray.length < ITEM_TRAY_SIZE; i++) {
			p.itemTray.push(CONSUMABLE_ALPHA_MARK)
		}
		// (5) 每 3 场玩家对战后下一次商店被峡谷野怪占领（计数在 settleTraitCombat）
		if (rb.breakpointIndex >= 1 && p.riftbeastCombats >= 3) {
			p.riftbeastCombats = 0
			p.ignitedSlots = []
			const beasts = CHAMPIONS.filter(
				(c) => c.traits.includes('DA_Riftbeast18') && pool.remainingOf(c.apiName) > 0,
			)
			if (beasts.length > 0) {
				p.shop = Array.from({ length: SHOP_SIZE }, () => beasts[rng.int(beasts.length)].apiName)
			}
		}
	}
	// 魔女：激活即初始化精粹（击杀/败北累计在 settleTraitCombat）
	const coven = active.find((t) => t.apiName === 'DA_18_Coven')
	if (coven && p.covenEssence < 0)
		p.covenEssence = TRAIT_BY_API.get('DA_18_Coven')?.vars[0]?.['{d62ae6ae}'] ?? 40
	// 地狱火(3/5/7)：引燃 1/2/4 个非地狱火棋子槽位，刷新出高一费棋子
	const inferno = active.find((t) => t.apiName === 'DA_18_Inferno')
	if (inferno && inferno.breakpointIndex >= 1) {
		const infernoVars = TRAIT_BY_API.get('DA_18_Inferno')?.vars[inferno.breakpointIndex]
		const count = Math.round(infernoVars?.['{c4c70a4e}'] ?? 0)
		const candidates = p.shop
			.map((api, i) => ({ api, i }))
			.filter(
				(x): x is { api: string; i: number } =>
					x.api !== null && !CHAMPION_BY_API.get(x.api)?.traits.includes('DA_18_Inferno'),
			)
		for (const x of rng.shuffle(candidates).slice(0, count)) {
			const newCost = Math.min(5, costOf(x.api) + 1)
			const costPool = CHAMPIONS.filter(
				(c) => c.cost === newCost && pool.remainingOf(c.apiName) > 0,
			)
			if (costPool.length === 0) continue
			p.shop[x.i] = costPool[rng.int(costPool.length)].apiName
			if (!p.ignitedSlots.includes(x.i)) p.ignitedSlots.push(x.i)
		}
	}
}

/** 羁绊战斗结算：峡谷野怪(5)玩家对战计数 + 魔女精粹收集（数值取自官方 vars） */
export function settleTraitCombat(p: PlayerState, rec: CombatRecord): void {
	const activeNow = computeActiveTraits(p.board)
	const rbNow = activeNow.find((t) => t.apiName === 'DA_Riftbeast18')
	if (!rec.isPvE && rbNow && rbNow.breakpointIndex >= 1) p.riftbeastCombats += 1
	const covenNow = activeNow.find((t) => t.apiName === 'DA_18_Coven')
	if (covenNow) {
		const covenVars = TRAIT_BY_API.get('DA_18_Coven')?.vars[covenNow.breakpointIndex]
		if (p.covenEssence < 0)
			p.covenEssence = TRAIT_BY_API.get('DA_18_Coven')?.vars[0]?.['{d62ae6ae}'] ?? 40
		const perKill = covenVars?.['{7a9d7f0e}'] ?? 2
		const perLoss = covenVars?.['{de46577b}'] ?? 18
		const oppSurvivors = rec.playerSide === 'A' ? rec.result.survivorsB : rec.result.survivorsA
		const oppInputs = rec.playerSide === 'A' ? rec.inputsB : rec.inputsA
		const kills = Math.max(0, oppInputs.length - oppSurvivors)
		p.covenEssence += perKill * kills
		const won =
			(rec.result.winner === 'A' && rec.playerSide === 'A') ||
			(rec.result.winner === 'B' && rec.playerSide === 'B')
		if (!rec.isPvE && !won && rec.result.winner !== 'draw') p.covenEssence += perLoss
	}
}

/** 战斗插件上报的跨战斗指标折现：茂凯叠层 / 雷恩加尔金币 / 黄金皮克斯 / 假人金币 / 替罪羊 */
export function settleCombatMetrics(p: PlayerState, rec: CombatRecord): void {
	const metrics = rec.playerSide === 'A' ? rec.result.metricsA : rec.result.metricsB
	if (metrics.maokaiStacks) p.maokaiStacks += metrics.maokaiStacks
	if (metrics.rivalTakedowns) {
		const prev = p.rivalTakedowns
		p.rivalTakedowns += metrics.rivalTakedowns
		p.gold +=
			(Math.floor(p.rivalTakedowns / RIVAL_TAKEDOWN_GOLD.per) -
				Math.floor(prev / RIVAL_TAKEDOWN_GOLD.per)) *
			RIVAL_TAKEDOWN_GOLD.gold
	}
	if (metrics.faeGoldPixies) p.gold += metrics.faeGoldPixies * FAE_PIXIE_GOLD
	// 假人金币按存活时长结算；替罪羊仅玩家对战
	if (metrics.dummyGold) p.gold += metrics.dummyGold
	if (!rec.isPvE && metrics.scapegoatGold) p.gold += metrics.scapegoatGold
}
