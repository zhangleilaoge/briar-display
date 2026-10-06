// 武器库（锻造器 N 选一）：池定义、开库、挑选（含连锁）、纹章/棋子发放、等级触发
import { ITEM_TRAY_SIZE } from '../data/rules'
import {
	CHAMPIONS,
	CHAMPION_BY_API,
	ITEMS,
	ITEM_BY_API,
	ITEM_COMPONENTS,
	TRAITS,
} from '../data/set18'
import { AUGMENT_BY_API, type ArmoryChain, type ArmoryPool } from '../data/set18/augments'
import { isPlaceholderItem, isRadiant } from './items'
import type { Rng } from './rng'
import type { PlayerState } from './types'

/** 随机成装池（占位装/冠冕/腐化装/光明装/纹章/神器除外），拆卸器重铸与魔女奖励共用 */
export const CRAFTABLE_POOL = ITEMS.filter(
	(i) =>
		!isPlaceholderItem(i.apiName) &&
		!i.apiName.includes('Tactician') &&
		!i.apiName.includes('Corrupted') &&
		!i.isRadiant &&
		!i.grantsTrait &&
		!i.isArtifact,
)

/** 武器库选项池：神器 / 纹章 / 光明装 / 腐化装（成装沿用 CRAFTABLE_POOL，散件沿用 ITEM_COMPONENTS） */
export const ARTIFACT_POOL = ITEMS.filter((i) => i.isArtifact).map((i) => i.apiName)
export const EMBLEM_POOL = ITEMS.filter((i) => i.grantsTrait).map((i) => i.apiName)
export const RADIANT_POOL = ITEMS.filter((i) => i.isRadiant).map((i) => i.apiName)
export const CORRUPTED_POOL = ITEMS.filter((i) => i.apiName.includes('Corrupted')).map(
	(i) => i.apiName,
)

/** 创世神拉克丝羁绊池：排除个人专属羁绊与日月双蚀（非拉克丝形态） */
export const LUX_TRAIT_POOL = TRAITS.filter(
	(t) => !t.apiName.includes('Unique') && t.apiName !== 'DA_18_Eclipse',
).map((t) => t.apiName)

export const armoryPoolOf = (pool: ArmoryPool): string[] => {
	switch (pool) {
		case 'artifact':
			return ARTIFACT_POOL
		case 'component':
			return ITEM_COMPONENTS.map((i) => i.apiName)
		case 'emblem':
			return EMBLEM_POOL
		case 'radiant':
			return RADIANT_POOL
		case 'trait':
			return LUX_TRAIT_POOL
		default:
			return CRAFTABLE_POOL.map((i) => i.apiName)
	}
}

/** 重铸分类池：同类别随机变形（散件/神器/纹章/腐化/光明/成装各自成池） */
export function rerollPoolFor(apiName: string): string[] {
	const def = ITEM_BY_API.get(apiName)
	if (!def) return CRAFTABLE_POOL.map((i) => i.apiName)
	if (ITEM_COMPONENTS.some((c) => c.apiName === apiName))
		return ITEM_COMPONENTS.map((i) => i.apiName)
	if (def.isArtifact) return ARTIFACT_POOL
	if (def.grantsTrait) return EMBLEM_POOL
	if (def.isRadiant) return RADIANT_POOL
	if (apiName.includes('Corrupted')) return CORRUPTED_POOL
	return CRAFTABLE_POOL.map((i) => i.apiName)
}

/** 拉克丝羁绊库加权抽样：棋盘已有羁绊权重 = 1 + 计数（官方：更可能出现棋盘上已有的羁绊） */
const weightedTraitSample = (rng: Rng, p: PlayerState, n: number): string[] => {
	const entries = LUX_TRAIT_POOL.map((trait) => ({
		trait,
		weight:
			1 +
			p.board.filter(
				(u) => CHAMPION_BY_API.get(u.apiName)?.traits.includes(trait) || u.chosenTrait === trait,
			).length,
	}))
	const out: string[] = []
	for (let k = 0; k < n && entries.length > 0; k++) {
		let roll = rng.next() * entries.reduce((sum, e) => sum + e.weight, 0)
		let idx = 0
		for (; idx < entries.length; idx++) {
			roll -= entries[idx].weight
			if (roll <= 0) break
		}
		out.push(entries.splice(Math.min(idx, entries.length - 1), 1)[0].trait)
	}
	return out
}

/** 开一个武器库；已有待处理的则排队（并发场景：海克斯 + 等级触发同时命中） */
export function openArmory(
	rng: Rng,
	p: PlayerState,
	pool: ArmoryPool,
	options = 4,
	source = '',
	chain?: ArmoryChain,
): void {
	const offer = {
		pool,
		options:
			pool === 'trait'
				? weightedTraitSample(rng, p, options)
				: rng.shuffle([...armoryPoolOf(pool)]).slice(0, options),
		source,
		...(chain ? { chain } : {}),
	}
	if (p.armory) p.armoryQueue.push(offer)
	else p.armory = offer
}

/** 挑选武器库选项；连锁发放（套娃）：chain.pool 开下一个库并把 gold 沿链传递，纯 gold 直接入账 */
export function pickArmory(rng: Rng, p: PlayerState, itemApi: string): boolean {
	if (!p.armory || !p.armory.options.includes(itemApi)) return false
	const chain = p.armory.chain
	const source = p.armory.source
	if (p.itemTray.length < ITEM_TRAY_SIZE) p.itemTray.push(itemApi)
	p.armory = p.armoryQueue.shift() ?? null
	if (chain?.pool)
		openArmory(rng, p, chain.pool, 4, source, chain.gold ? { gold: chain.gold } : undefined)
	else if (chain?.gold) p.gold += chain.gold
	return true
}

/** 随机纹章入栏；memoKey 非空时记录其羁绊（硬性承诺/水乳交融取最近一次） */
export function grantRandomEmblem(rng: Rng, p: PlayerState, memoKey?: string): void {
	if (EMBLEM_POOL.length === 0) return
	const api = EMBLEM_POOL[rng.int(EMBLEM_POOL.length)]
	if (p.itemTray.length < ITEM_TRAY_SIZE) p.itemTray.push(api)
	const trait = ITEM_BY_API.get(api)?.grantsTrait
	if (trait && memoKey) p.augMemo[`${memoKey}.trait`] = trait
}

/** 硬性承诺：纹章羁绊的 1 星棋子（费用=当前阶段数，无则就近取）+ 金币 */
export function grantStageEmblemChamp(
	rng: Rng,
	p: PlayerState,
	stage: number,
	augApi: string,
	gold: number,
	grantChamp: (champApi: string) => void,
): void {
	const trait = p.augMemo[`${augApi}.trait`]
	if (typeof trait === 'string') {
		const want = Math.min(5, stage)
		const all = CHAMPIONS.filter((c) => c.traits.includes(trait))
		const pool =
			all.length > 0
				? [...all].sort(
						(a, b) => Math.abs(a.cost - want) - Math.abs(b.cost - want) || a.cost - b.cost,
					)
				: []
		if (pool.length > 0) grantChamp(pool[0].apiName)
	}
	p.gold += gold
}

/** 游神的眷顾：到达指定等级时开基础装备锻造器（已越过的等级可追溯补发） */
export function checkLevelArmories(rng: Rng, p: PlayerState): void {
	for (const a of p.augments) {
		const def = AUGMENT_BY_API.get(a)
		if (!def) continue
		for (const e of def.effects) {
			if (e.kind !== 'armoryAtLevels') continue
			for (const lvl of e.levels) {
				const key = `${a}.lvl${lvl}`
				if (p.level >= lvl && !p.augMemo[key]) {
					p.augMemo[key] = 1
					openArmory(rng, p, e.pool, 4, a)
				}
			}
		}
	}
}
