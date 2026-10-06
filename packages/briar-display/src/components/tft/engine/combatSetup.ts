import { TRAIT_BY_API } from '../data/set18'
// 开战输入装配：玩家棋盘 → 战斗输入（含羁绊面板/海克斯增益/假人标记），PvE 野怪波次生成
import { AUGMENT_BY_API } from '../data/set18/augments'
import { MONSTER_BY_API, pveStatScale, pveWaveFor } from '../data/set18/monsters'
import { CRAFTABLE_POOL, RADIANT_POOL } from './armory'
import type { CombatUnitInput } from './combat'
import { type ItemTag, itemGrantedTrait } from './items'
import { applyPlayerBuffs } from './playerBuffs'
import { MAOKAI_STACK_HP_VAR } from './plugins/traits/stacking'
import type { Rng } from './rng'
import { applyTraitStats } from './traitEffects'
import { computeActiveTraits } from './traits'
import type { PlayerState } from './types'
import { unitStats } from './units'

const isRadiantTG = (api: string) => api.includes('Radiant')
const isTG = (api: string) => api.includes('ThiefsGloves')

/** 窃贼手套：开战时展开为 2 件随机装备（光明版从光明池抽）；装备回合间不保留 */
const expandThiefsGloves = (rng: Rng | undefined, items: string[]): string[] => {
	if (!rng || !items.some(isTG)) return items
	const out: string[] = []
	for (const api of items) {
		if (!isTG(api)) {
			out.push(api)
			continue
		}
		const pool = isRadiantTG(api) ? RADIANT_POOL : CRAFTABLE_POOL.map((i) => i.apiName)
		for (let i = 0; i < 2 && pool.length > 0; i++) out.push(pool[rng.int(pool.length)])
	}
	return out
}

/** 玩家棋盘 → 战斗输入：面板 = 基础 x 羁绊 x 海克斯；假人附带海克斯标记（金币/碰撞/替罪羊） */
export function toCombatInput(p: PlayerState, stage: number, rng?: Rng): CombatUnitInput[] {
	const active = computeActiveTraits(p.board)
	// 远古树精：永久叠层作用于最强大的那个茂凯（每层血量与战斗内插件同一官方变量）
	const hpPerStack =
		TRAIT_BY_API.get('DA_18_Maokai_UniqueTrait')?.vars[0]?.[MAOKAI_STACK_HP_VAR] ?? 30
	const maokaiHpBonus = p.maokaiStacks > 0 ? p.maokaiStacks * hpPerStack : 0
	const strongestMao = maokaiHpBonus
		? [...p.board].filter((b) => b.apiName === 'DA_18_Maokai').sort((a, b) => b.star - a.star)[0]
				?.uid
		: undefined
	const augEffects = p.augments.flatMap((a) => AUGMENT_BY_API.get(a)?.effects ?? [])
	const dummyGold = augEffects.find((e) => e.kind === 'dummyGold')
	const crashTest = augEffects.find((e) => e.kind === 'crashTest')
	const scapegoat = augEffects.find((e) => e.kind === 'scapegoatGold')
	// 致命丽花等：纹章携带者羁绊效能放大
	const emblemAmps = augEffects.filter((e) => e.kind === 'emblemTraitAmp')
	// 正义报复等：指定装备携带者获得技能暴击
	const abilityCritItems = augEffects
		.filter((e) => e.kind === 'holderBuff' && e.abilityCrit && e.item)
		.map((e) => (e as { item?: string }).item as string)
	return p.board.map((b) => {
		const stats = applyPlayerBuffs(p, applyTraitStats(b, unitStats(b), active), b)
		if (b.uid === strongestMao) stats.maxHp += maokaiHpBonus
		// 假人随阶段成长（官方固定值，每阶段 +hpPerStage）
		const hpPerStage = MONSTER_BY_API.get(b.apiName)?.hpPerStage
		if (hpPerStage) stats.maxHp += hpPerStage * (stage - 1)
		const isDummy = MONSTER_BY_API.has(b.apiName)
		const items = expandThiefsGloves(rng, b.items)
		const extraTags: ItemTag[] | undefined =
			abilityCritItems.length > 0 && items.some((i) => abilityCritItems.includes(i))
				? ['abilityCrit']
				: undefined
		let traitAmp: Record<string, number> | undefined
		for (const e of emblemAmps) {
			if (e.kind !== 'emblemTraitAmp') continue
			if (items.some((i) => itemGrantedTrait(i) === e.trait))
				traitAmp = { ...traitAmp, [e.trait]: 1 + e.pct }
		}
		return {
			uid: b.uid,
			apiName: b.apiName,
			star: b.star,
			pos: b.pos,
			stats,
			items,
			alphaMark: b.alphaMark,
			chosenTrait: b.chosenTrait,
			traitAmp,
			extraTags,
			dummyGold:
				isDummy && dummyGold?.kind === 'dummyGold'
					? [dummyGold.perSeconds, dummyGold.amount]
					: undefined,
			crashTestStun: isDummy && crashTest?.kind === 'crashTest' ? crashTest.stun : undefined,
			scapegoatGold: isDummy && scapegoat?.kind === 'scapegoatGold' ? scapegoat.amount : undefined,
		}
	})
}

/** 按 stage-round 查野怪波次表；Boss 轮（5-7 起）数值按阶段放大 */
export function buildPveWave(stage: number, round: number): CombatUnitInput[] {
	const scale = pveStatScale(stage)
	return pveWaveFor(stage, round).map((spawn, i) => {
		const st = MONSTER_BY_API.get(spawn.apiName)?.stats
		return {
			uid: `pve-${stage}-${round}-${i}`,
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
