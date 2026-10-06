import { CHAMPION_BY_API } from '../data/set18'
import { type StatMods, applyMods } from './statsMods'
import type { ActiveTrait } from './traits'
import type { CombatStats, UnitInstance } from './types'

export interface TraitEffectDef {
	/** team = 全队生效；trait = 仅该羁绊棋子生效 */
	scope: 'team' | 'trait'
	mods: StatMods
	/** 机制标签：ability-crit 由 combat.ts 判定；其余仅作文档标记，机制在 plugins/traits 实现 */
	customTag?: string
}

/**
 * 36 个羁绊的效果表：按档位索引排列（与 set18 traits.breakpoints 对齐）。
 * 纯数值羁绊按官方 vars 落面板；机制型羁绊 mods 置空，由 plugins/traits 插件按官方 vars 实现。
 */
export const TRAIT_EFFECTS: Record<string, TraitEffectDef[]> = {
	// 永恒之森：植物由 elderwood 插件开战召唤
	DA_18_Elderwood: [
		{ scope: 'team', mods: {}, customTag: 'elderwood-plants' },
		{ scope: 'team', mods: {}, customTag: 'elderwood-plants' },
		{ scope: 'team', mods: {}, customTag: 'elderwood-plants' },
		{ scope: 'team', mods: {}, customTag: 'elderwood-plants' },
		{ scope: 'team', mods: {}, customTag: 'elderwood-plants' },
	],
	// 大元素使：商店转换 + 选定羁绊 +2 —— 机制由 gameLoop 特判，战斗无面板效果
	DA_18_LuxUniqueTrait: [{ scope: 'team', mods: {}, customTag: 'lux-elemental' }],
	// 狂战士：全能吸血 10% + 额外伤害 12/25/40%（低血翻倍由 slayer 插件）
	DA_18_Slayer: [
		{ scope: 'trait', mods: { omnivamp: 0.1, damageAmp: 0.12 } },
		{ scope: 'trait', mods: { omnivamp: 0.1, damageAmp: 0.25 } },
		{ scope: 'trait', mods: { omnivamp: 0.1, damageAmp: 0.4 } },
	],
	// 赏金猎人：经济机制，战斗无效果
	DA_DravenUniqueTrait18: [{ scope: 'team', mods: {}, customTag: 'draven-bounty' }],
	// 日蚀骑士：护盾/附加魔伤/3 星加成由 solar 插件
	DA_18_Solar: [{ scope: 'team', mods: {}, customTag: 'solar-shield' }],
	// 约德尔人和朋友：大朋友召唤与骑乘者增益由 sprykin 插件
	DA_18_Sprykin: [
		{ scope: 'trait', mods: {}, customTag: 'yordle-rider' },
		{ scope: 'trait', mods: {}, customTag: 'yordle-rider' },
		{ scope: 'trait', mods: {}, customTag: 'yordle-rider' },
	],
	// 魔战士：按 AD/AP 较高者增益 25/35/50%，由 adaptor 插件
	DA_18_Adaptor: [
		{ scope: 'trait', mods: {}, customTag: 'adaptor-higher' },
		{ scope: 'trait', mods: {}, customTag: 'adaptor-higher' },
		{ scope: 'trait', mods: {}, customTag: 'adaptor-higher' },
	],
	// 魔女：精粹累计/兑换由 gameLoop，战斗无面板效果
	DA_18_Coven: [
		{ scope: 'team', mods: {}, customTag: 'coven-essence' },
		{ scope: 'team', mods: {}, customTag: 'coven-essence' },
		{ scope: 'team', mods: {}, customTag: 'coven-essence' },
		{ scope: 'team', mods: {}, customTag: 'coven-essence' },
	],
	// 日月双蚀：周期性处决最低生命敌人，由 eclipse 插件
	DA_18_Eclipse: [{ scope: 'team', mods: {}, customTag: 'eclipse-execute' }],
	// 猎人：物理加成 20/30/45/65%（不换目标增伤由 hunter 插件）
	DA_18_Hunter: [
		{ scope: 'trait', mods: { adPct: 0.2 } },
		{ scope: 'trait', mods: { adPct: 0.3 } },
		{ scope: 'trait', mods: { adPct: 0.45 } },
		{ scope: 'trait', mods: { adPct: 0.65 } },
	],
	// 远古树精：附近敌人阵亡叠永久生命，由 maokaiStack 插件 + gameLoop 持久化
	DA_18_Maokai_UniqueTrait: [{ scope: 'trait', mods: {}, customTag: 'maokai-stack' }],
	// 魔岩巨兽：每被一名敌人选中 +10 双抗，由 battlemage 插件动态结算
	DA_18_Battlemage: [{ scope: 'trait', mods: {}, customTag: 'battlemage-resists' }],
	// 野兽之灵：四选一赐福由 gameLoop；战斗增益按所选赐福由 gameLoop 注入（待做）
	DA_Primal18: [
		{ scope: 'team', mods: {}, customTag: 'primal-blessing' },
		{ scope: 'team', mods: {}, customTag: 'primal-blessing' },
	],
	// 翠神：种子培育格子 —— 机制由 gameLoop（待做），战斗无面板效果
	DA_18_Greenfather: [{ scope: 'team', mods: {}, customTag: 'ivern-seeds' }],
	// 神谕：全队回蓝 1/1/2/2，神谕额外 +2/3/5/8
	DA_18_Invoker: [
		{ scope: 'team', mods: { manaRegen: 1 } },
		{ scope: 'team', mods: { manaRegen: 1 } },
		{ scope: 'team', mods: { manaRegen: 2 } },
		{ scope: 'team', mods: { manaRegen: 2 } },
	],
	// 迅捷射手：全队攻速 10%（射手攻击叠攻速由 rapidfire 插件）
	DA_18_Rapidfire: [
		{ scope: 'team', mods: { attackSpeedPct: 0.1 } },
		{ scope: 'team', mods: { attackSpeedPct: 0.1 } },
		{ scope: 'team', mods: { attackSpeedPct: 0.1 } },
		{ scope: 'team', mods: { attackSpeedPct: 0.1 } },
	],
	// 主宰：全队减伤 4/6/8%，主宰额外 20/33/45%
	DA_Juggernaut18: [
		{ scope: 'team', mods: { damageReduction: 0.04 } },
		{ scope: 'team', mods: { damageReduction: 0.06 } },
		{ scope: 'team', mods: { damageReduction: 0.08 } },
	],
	// 地狱火：灼烧+重伤由 inferno 插件
	DA_18_Inferno: [
		{ scope: 'trait', mods: {}, customTag: 'inferno-burn' },
		{ scope: 'trait', mods: {}, customTag: 'inferno-burn' },
		{ scope: 'trait', mods: {}, customTag: 'inferno-burn' },
		{ scope: 'trait', mods: {}, customTag: 'inferno-burn' },
	],
	// 月华神女：月相减伤/增伤由 aluneMoon 插件
	DA_AluneUniqueTrait18: [{ scope: 'team', mods: {}, customTag: 'alune-moon' }],
	// 宿敌：参与击杀计数由 rival 插件 + gameLoop 金币结算
	DA_18_Rival: [
		{ scope: 'trait', mods: {}, customTag: 'rival-takedown' },
		{ scope: 'trait', mods: {}, customTag: 'rival-takedown' },
		{ scope: 'trait', mods: {}, customTag: 'rival-takedown' },
	],
	// 重装战士：开战/低血护盾由 vanguard 插件
	DA_18_Vanguard: [
		{ scope: 'trait', mods: {}, customTag: 'vanguard-shield' },
		{ scope: 'trait', mods: {}, customTag: 'vanguard-shield' },
		{ scope: 'trait', mods: {}, customTag: 'vanguard-shield' },
	],
	// 斗士：全队 +120 生命，斗士额外 25/40/65% 生命
	DA_18_Brawler: [
		{ scope: 'team', mods: { maxHp: 120 } },
		{ scope: 'team', mods: { maxHp: 120 } },
		{ scope: 'team', mods: { maxHp: 120 } },
	],
	// 黑荆棘：献祭格 UI 待做，暂以生命近似占位
	DA_18_Blackthorn: [
		{ scope: 'trait', mods: { maxHpPct: 0.15 }, customTag: 'blackthorn-sacrifice' },
		{ scope: 'trait', mods: { maxHpPct: 0.3 }, customTag: 'blackthorn-sacrifice' },
		{ scope: 'trait', mods: { maxHpPct: 0.5 }, customTag: 'blackthorn-sacrifice' },
	],
	// 裁决使：技能暴击 + 15% 暴击率（流血由 executioner 插件）
	DA_18_Executioner: [
		{ scope: 'trait', mods: { critChance: 0.15 }, customTag: 'ability-crit' },
		{ scope: 'trait', mods: { critChance: 0.15 }, customTag: 'ability-crit' },
		{ scope: 'trait', mods: { critChance: 0.15 }, customTag: 'ability-crit' },
	],
	// 顶级掠食者：占 2 格 + 峡谷野怪 +2 —— 机制在 traits.ts/units.ts
	DA_18_ApexPredator: [{ scope: 'team', mods: {}, customTag: 'apex-predator' }],
	// 峡谷野怪：(3)印记/(5)商店占领由 gameLoop；(7)成长/(10)+2 人口由 riftbeastGrowth 插件/units.teamCap
	DA_Riftbeast18: [
		{ scope: 'trait', mods: {}, customTag: 'riftbeast-mark' },
		{ scope: 'trait', mods: {}, customTag: 'riftbeast-mark' },
		{ scope: 'trait', mods: {}, customTag: 'riftbeast-growth' },
		{ scope: 'trait', mods: {}, customTag: 'riftbeast-elder' },
	],
	// 帝王斑蝶：双抗击碎由 caustic 插件
	DA_18_Caustic: [{ scope: 'trait', mods: {}, customTag: 'caustic-shred' }],
	// 花仙子：皮克斯计数/治疗由 fae 插件
	DA_18_Fae: [
		{ scope: 'trait', mods: {}, customTag: 'fae-pixies' },
		{ scope: 'trait', mods: {}, customTag: 'fae-pixies' },
	],
	// 月蚀骑士：自身+邻格攻速/法强由 lunar 插件（站位敏感）
	DA_18_Lunar: [
		{ scope: 'trait', mods: {}, customTag: 'lunar-aura' },
		{ scope: 'trait', mods: {}, customTag: 'lunar-aura' },
		{ scope: 'trait', mods: {}, customTag: 'lunar-aura' },
		{ scope: 'trait', mods: {}, customTag: 'lunar-aura' },
	],
	// 护卫：全队 +12 双抗，护卫额外 25/60/120
	DA_18_Defender: [
		{ scope: 'team', mods: { armor: 12, magicResist: 12 } },
		{ scope: 'team', mods: { armor: 12, magicResist: 12 } },
		{ scope: 'team', mods: { armor: 12, magicResist: 12 } },
	],
	// 法师：全队 +10% 法强，法师额外 +10/30/55%（施法叠法强由 spellweaver 插件）
	DA_18_Spellweaver: [
		{ scope: 'team', mods: { abilityPower: 10 } },
		{ scope: 'team', mods: { abilityPower: 10 } },
		{ scope: 'team', mods: { abilityPower: 10 } },
	],
	// 荆棘之兴：按存活植物数减伤，由 zyraPlants 插件
	DA_18_ZyraUniqueTrait: [{ scope: 'team', mods: {}, customTag: 'zyra-plants' }],
	// 绝命花妖：击杀回蓝+治疗由 floraFatalis 插件
	DA_FloraFatalis18: [
		{ scope: 'trait', mods: {}, customTag: 'flora-harvest' },
		{ scope: 'trait', mods: {}, customTag: 'flora-harvest' },
	],
	// 召唤师：强化召唤物由 summoner 插件
	DA_18_Summoner: [
		{ scope: 'trait', mods: {}, customTag: 'summoner-buff' },
		{ scope: 'trait', mods: {}, customTag: 'summoner-buff' },
	],
	// 灵魂莲华：12/30/45/50/100% AD&AP + 10% 生命（自然仙灵强化由 gameLoop）
	DA_18_Blossom: [
		{ scope: 'trait', mods: { adPct: 0.12, abilityPower: 12, maxHpPct: 0.1 } },
		{ scope: 'trait', mods: { adPct: 0.3, abilityPower: 30, maxHpPct: 0.1 } },
		{ scope: 'trait', mods: { adPct: 0.45, abilityPower: 45, maxHpPct: 0.1 } },
		{ scope: 'trait', mods: { adPct: 0.5, abilityPower: 50, maxHpPct: 0.1 } },
		{ scope: 'trait', mods: { adPct: 1, abilityPower: 100, maxHpPct: 0.1 } },
	],
	// 宝石骑士：配对机制由塔里克技能插件 + gameLoop 配对 UI（待做）
	DA_Emerald18: [{ scope: 'team', mods: {}, customTag: 'taric-pair' }],
}

/** 羁绊棋子额外享受的「更多」档：仅对该羁绊棋子生效的第二层修饰 */
const TRAIT_SELF_BONUS: Record<string, StatMods[]> = {
	DA_18_Invoker: [{ manaRegen: 2 }, { manaRegen: 3 }, { manaRegen: 5 }, { manaRegen: 8 }],
	DA_Juggernaut18: [{ damageReduction: 0.2 }, { damageReduction: 0.33 }, { damageReduction: 0.45 }],
	DA_18_Brawler: [{ maxHpPct: 0.25 }, { maxHpPct: 0.4 }, { maxHpPct: 0.65 }],
	DA_18_Defender: [
		{ armor: 25, magicResist: 25 },
		{ armor: 60, magicResist: 60 },
		{ armor: 120, magicResist: 120 },
	],
	DA_18_Spellweaver: [{ abilityPower: 10 }, { abilityPower: 30 }, { abilityPower: 55 }],
}

/** 把激活羁绊结算到棋子面板（team 全队 + trait 仅羁绊成员 + self 额外层） */
export function applyTraitStats(
	unit: UnitInstance,
	stats: CombatStats,
	active: ActiveTrait[],
): CombatStats {
	const unitTraits = new Set(CHAMPION_BY_API.get(unit.apiName)?.traits ?? [])
	// 拉克丝选定的羁绊同样享受羁绊面板
	if (unit.chosenTrait) unitTraits.add(unit.chosenTrait)
	for (const a of active) {
		const defs = TRAIT_EFFECTS[a.apiName]
		const def = defs?.[a.breakpointIndex]
		if (def && (def.scope === 'team' || unitTraits.has(a.apiName))) {
			applyMods(stats, def.mods)
		}
		const selfMods = TRAIT_SELF_BONUS[a.apiName]?.[a.breakpointIndex]
		if (selfMods && unitTraits.has(a.apiName)) applyMods(stats, selfMods)
	}
	stats.maxHp = Math.round(stats.maxHp)
	stats.attackDamage = Math.round(stats.attackDamage)
	return stats
}
