import { ITEMS, ITEM_BY_API, ITEM_COMPONENTS } from '../data/set18'
import type { StatMods } from './statsMods'

/** 上游 51 件合成装里含 2 件未本地化占位装，全局忽略 */
const PLACEHOLDER_ITEMS = new Set(['TFT_Item_CursedBlade', 'TFT_Item_HextechChestguard'])
export const isPlaceholderItem = (apiName: string) => PLACEHOLDER_ITEMS.has(apiName)

export const isComponent = (apiName: string) => ITEM_BY_API.get(apiName)?.isComponent === true

/** 两件散件合成成装（无序匹配官方合成表）；散件顺序无关，同件可自合 */
export function combineComponents(a: string, b: string): string | null {
	if (!isComponent(a) || !isComponent(b)) return null
	const pair = [a, b].sort().join('|')
	const hit = ITEMS.find(
		(i) =>
			!isPlaceholderItem(i.apiName) &&
			i.composition.length === 2 &&
			[...i.composition].sort().join('|') === pair,
	)
	return hit?.apiName ?? null
}

/** 纹章类装备提供的羁绊 apiName（S18 合成池无纹章，保留通路供 PvE 掉落扩展） */
export function itemGrantedTrait(apiName: string): string | null {
	const item = ITEM_BY_API.get(apiName)
	if (!item) return null
	const m = item.desc.match(/【(.+?)】羁绊/)
	return m ? m[1] : null
}

/**
 * 装备数值 → 通用修饰。官方数据口径：AD 为小数比例（0.35=+35%），
 * AS/CritChance 为百分数（10=+10%），AP/Health/Armor/MR 为加法，ManaRegen 1 点折算 15 初始蓝
 */
export function itemStatMods(apiName: string): StatMods {
	const e = ITEM_BY_API.get(apiName)?.effects
	if (!e) return {}
	const mods: StatMods = {}
	if (e.Health) mods.maxHp = e.Health
	if (e.AD) mods.adPct = e.AD
	if (e.AP) mods.abilityPower = e.AP
	if (e.AS) mods.attackSpeedPct = e.AS / 100
	if (e.Armor) mods.armor = e.Armor
	if (e.MagicResist) mods.magicResist = e.MagicResist
	if (e.CritChance) mods.critChance = e.CritChance / 100
	if (e.ManaRegen) mods.initialMana = e.ManaRegen * 15
	if (e.CombatStartMana) mods.initialMana = (mods.initialMana ?? 0) + e.CombatStartMana
	return mods
}

/** 装备机制标签：M3 战斗结算用。按 effects key + desc 关键词判定 */
export type ItemTag =
	| 'abilityCrit'
	| 'lifesteal'
	| 'lowhpShield'
	| 'asStack'
	| 'apStack'
	| 'mrShredOnHit'
	| 'burnOnHit'
	| 'giantSlayer'

export function itemTags(apiName: string): ItemTag[] {
	const item = ITEM_BY_API.get(apiName)
	if (!item) return []
	const e = item.effects
	const tags = new Set<ItemTag>()
	if (item.desc.includes('技能暴击')) tags.add('abilityCrit')
	if (e.LifeSteal || e.StatOmnivamp) tags.add('lifesteal')
	if (e.ShieldHealthPercent && e.HealthThreshold) tags.add('lowhpShield')
	if (e.AttackSpeedPerStack) tags.add('asStack')
	if (e.APPerInterval) tags.add('apStack')
	if (e.MRShred) tags.add('mrShredOnHit')
	if (e.PercentHealthDamage) tags.add('giantSlayer')
	if (item.desc.includes('灼烧') || item.desc.includes('重伤')) tags.add('burnOnHit')
	return [...tags]
}

/** 棋子身上已有散件时自动合成（官方拖拽行为）；返回新生成的成装 apiName 列表 */
export function autoCraftOnUnit(unitItems: string[]): void {
	for (;;) {
		const comps = unitItems.filter(isComponent)
		if (comps.length < 2) return
		const crafted = combineComponents(comps[0], comps[1])
		if (!crafted) return
		for (const c of [comps[0], comps[1]]) unitItems.splice(unitItems.indexOf(c), 1)
		unitItems.push(crafted)
	}
}

export const COMPONENT_COUNT = ITEM_COMPONENTS.length
