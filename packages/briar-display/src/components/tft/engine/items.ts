import { ITEMS, ITEM_BY_API, ITEM_COMPONENTS } from '../data/set18'
import { ITEM_STAT_OVERRIDES } from '../data/set18/items/statOverrides'
import type { StatMods } from './statsMods'

/** 上游 51 件合成装里含 2 件未本地化占位装，全局忽略 */
const PLACEHOLDER_ITEMS = new Set(['TFT_Item_CursedBlade', 'TFT_Item_HextechChestguard'])
export const isPlaceholderItem = (apiName: string) => PLACEHOLDER_ITEMS.has(apiName)

export const isComponent = (apiName: string) => ITEM_BY_API.get(apiName)?.isComponent === true

export const isRadiant = (apiName: string) => ITEM_BY_API.get(apiName)?.isRadiant === true

/** 智慧末刃附伤按阶段成长（官方 8 个哈希变量按序排列，stage 1-8） */
export const WITS_END_STAGE_DAMAGE = [30, 30, 45, 65, 85, 100, 100, 100] as const

/** 装备 effects 数值读取（数据层同源，引擎不硬编码） */
export const itemEffectNum = (apiName: string, key: string): number | undefined =>
	ITEM_BY_API.get(apiName)?.effects[key]

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

/** 纹章类装备提供的羁绊 apiName */
export function itemGrantedTrait(apiName: string): string | null {
	return ITEM_BY_API.get(apiName)?.grantsTrait ?? null
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
	if (e.Range) mods.range = e.Range
	// 数据层修正表：官方 effects 缺失的字段（statOverrides.ts 手写维护）
	const o = ITEM_STAT_OVERRIDES[apiName]
	if (o) {
		for (const [k, v] of Object.entries(o)) {
			const key = k as keyof StatMods
			;(mods[key] as number) = ((mods[key] as number | undefined) ?? 0) + (v as number)
		}
	}
	return mods
}

/** 装备机制标签：M3 战斗结算用。通用装按 effects key + desc 关键词判定，神器按 apiName 精确映射 */
export type ItemTag =
	| 'abilityCrit'
	| 'lifesteal'
	| 'lowhpShield'
	| 'asStack'
	| 'apStack'
	| 'mrShredOnHit'
	| 'burnOnHit'
	| 'giantSlayer'
	// ---- 神器机制 ----
	/** 卢登的激荡：击杀时将过量伤害+100 弹射至最近 2 敌 */
	| 'ludensBounce'
	/** 顽强不屈：晕眩免疫 */
	| 'ccImmune'
	/** 激发之匣：被攻击回 1% 总蓝，施法回复 20% 最大生命 */
	| 'innervatingLocket'
	/** 疾射火炮：每击杀 1 敌再 +1 攻击距离（基础 +1 在 itemStatMods） */
	| 'rangeOnKill'
	/** 鱼骨头：普攻瞄准随机敌人 */
	| 'randomTarget'
	/** 巨型九头蛇：普攻对目标及邻格追加 4% 最大生命 + 6% AD 物理伤害 */
	| 'splashOnHit'
	/** 智慧末刃：普攻追加 65 魔法伤害并治疗携带者 30% */
	| 'onhitMagic'
	/** 暗行者之爪：击杀后净化并冲刺最远敌人，下 2 次暴击 +50% 暴伤 */
	| 'prowlDash'
	/** 飞升护符：22 秒后 +100% 最大生命与 +120% 伤害增幅 */
	| 'ascension'
	/** 探索者的护臂：参与击杀 +20 双抗与法强 */
	| 'takedownStack'

/** 神器 apiName → 机制标签 */
const ARTIFACT_TAGS: Record<string, ItemTag[]> = {
	TFT_Item_Artifact_LudensTempest: ['ludensBounce'],
	TFT_Item_Artifact_TheIndomitable: ['ccImmune'],
	TFT_Item_Artifact_InnervatingLocket: ['innervatingLocket'],
	TFT_Item_Artifact_RapidFirecannon: ['rangeOnKill'],
	TFT_Item_Artifact_Fishbones: ['randomTarget'],
	TFT_Item_Artifact_TitanicHydra: ['splashOnHit'],
	TFT_Item_Artifact_WitsEnd: ['onhitMagic'],
	TFT_Item_Artifact_ProwlersClaw: ['prowlDash'],
	TFT_Item_Artifact_TalismanOfAscension: ['ascension'],
	TFT_Item_Artifact_SeekersArmguard: ['takedownStack'],
}

export function itemTags(apiName: string): ItemTag[] {
	const item = ITEM_BY_API.get(apiName)
	if (!item) return []
	const e = item.effects
	const tags = new Set<ItemTag>(ARTIFACT_TAGS[apiName] ?? [])
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

/** 金铲铲/金锅锅系装备（含其合成产物：纹章、冠冕等） */
export const isSpatFamily = (apiName: string): boolean => {
	if (apiName.includes('Spatula') || apiName.includes('FryingPan')) return true
	const comp = ITEM_BY_API.get(apiName)?.composition ?? []
	return comp.some((c) => c.includes('Spatula') || c.includes('FryingPan'))
}
