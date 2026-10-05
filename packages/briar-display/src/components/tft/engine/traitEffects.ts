import { CHAMPION_BY_API } from '../data/set18'
import { type StatMods, applyMods } from './statsMods'
import type { ActiveTrait } from './traits'
import type { CombatStats, UnitInstance } from './types'

export interface TraitEffectDef {
	/** team = 全队生效；trait = 仅该羁绊棋子生效 */
	scope: 'team' | 'trait'
	mods: StatMods
	/** 无法用数值表达的机制标签，由 combat.ts 特判简化实现 */
	customTag?: string
}

/**
 * 36 个羁绊的效果表：按档位索引排列（与 set18 traits.breakpoints 对齐）。
 * 纯数值羁绊按官方描述落数值；机制型羁绊给近似数值 + customTag 供战斗特判。
 */
export const TRAIT_EFFECTS: Record<string, TraitEffectDef[]> = {
	// 永恒之森：可放置植物 —— 简化为全队生命，植物由 combat 特判（占位）
	DA_18_Elderwood: [
		{ scope: 'team', mods: { maxHpPct: 0.1 }, customTag: 'elderwood-plants' },
		{ scope: 'team', mods: { maxHpPct: 0.18 }, customTag: 'elderwood-plants' },
		{ scope: 'team', mods: { maxHpPct: 0.28 }, customTag: 'elderwood-plants' },
		{ scope: 'team', mods: { maxHpPct: 0.4 }, customTag: 'elderwood-plants' },
		{ scope: 'team', mods: { maxHpPct: 0.6 }, customTag: 'elderwood-plants' },
	],
	// 大元素使：商店转换 + 选定羁绊 +2 —— 机制由 gameLoop 特判，战斗无面板效果
	DA_18_LuxUniqueTrait: [{ scope: 'team', mods: {}, customTag: 'lux-elemental' }],
	// 狂战士：全能吸血 10%（官方 Omnivamp）+ 额外伤害 12/25/40%
	DA_18_Slayer: [
		{ scope: 'trait', mods: { omnivamp: 0.1, damageAmp: 0.12 } },
		{ scope: 'trait', mods: { omnivamp: 0.1, damageAmp: 0.25 } },
		{ scope: 'trait', mods: { omnivamp: 0.1, damageAmp: 0.4 } },
	],
	// 赏金猎人：经济机制，战斗无效果
	DA_DravenUniqueTrait18: [{ scope: 'team', mods: {}, customTag: 'draven-bounty' }],
	// 日蚀骑士：全队最大生命护盾 + 额外魔法伤害 → 生命 + 增伤
	DA_18_Solar: [{ scope: 'team', mods: { maxHpPct: 0.2, damageAmp: 0.15 } }],
	// 约德尔人和朋友：骑乘者增益 → 该羁绊棋子生命/攻击
	DA_18_Sprykin: [
		{ scope: 'trait', mods: { maxHpPct: 0.25, adPct: 0.15 }, customTag: 'yordle-rider' },
		{ scope: 'trait', mods: { maxHpPct: 0.4, adPct: 0.25 }, customTag: 'yordle-rider' },
		{ scope: 'trait', mods: { maxHpPct: 0.6, adPct: 0.4 }, customTag: 'yordle-rider' },
	],
	// 魔战士：按较高加成转换 → 双系加成
	DA_18_Adaptor: [
		{ scope: 'trait', mods: { adPct: 0.15, abilityPower: 15 } },
		{ scope: 'trait', mods: { adPct: 0.25, abilityPower: 25 } },
		{ scope: 'trait', mods: { adPct: 0.4, abilityPower: 40 } },
	],
	// 魔女：精粹兑换奖励 → 全队法强近似
	DA_18_Coven: [
		{ scope: 'team', mods: { abilityPower: 10 }, customTag: 'coven-essence' },
		{ scope: 'team', mods: { abilityPower: 20 }, customTag: 'coven-essence' },
		{ scope: 'team', mods: { abilityPower: 35 }, customTag: 'coven-essence' },
		{ scope: 'team', mods: { abilityPower: 60 }, customTag: 'coven-essence' },
	],
	// 日月双蚀：周期性处决最低生命敌人 —— combat 特判
	DA_18_Eclipse: [{ scope: 'team', mods: {}, customTag: 'eclipse-execute' }],
	// 猎人：物理加成 + 持续目标增伤 → AD + 增伤
	DA_18_Hunter: [
		{ scope: 'trait', mods: { adPct: 0.15, damageAmp: 0.05 } },
		{ scope: 'trait', mods: { adPct: 0.25, damageAmp: 0.08 } },
		{ scope: 'trait', mods: { adPct: 0.35, damageAmp: 0.12 } },
		{ scope: 'trait', mods: { adPct: 0.5, damageAmp: 0.18 } },
	],
	// 远古树精：附近敌人阵亡叠生命 → 固定生命近似
	DA_18_Maokai_UniqueTrait: [
		{ scope: 'trait', mods: { maxHpPct: 0.25 }, customTag: 'maokai-stack' },
	],
	// 魔岩巨兽：每被一名敌人选中获得双抗 → 固定双抗近似
	DA_18_Battlemage: [{ scope: 'trait', mods: { armor: 40, magicResist: 40 } }],
	// 野兽之灵：四选一赐福 → 全队增伤
	DA_Primal18: [
		{ scope: 'team', mods: { damageAmp: 0.1 }, customTag: 'primal-blessing' },
		{ scope: 'team', mods: { damageAmp: 0.2 }, customTag: 'primal-blessing' },
	],
	// 翠神：种子培育格子 —— 机制，战斗无面板效果
	DA_18_Greenfather: [{ scope: 'team', mods: {}, customTag: 'ivern-seeds' }],
	// 神谕：全队回蓝，神谕翻倍
	DA_18_Invoker: [
		{ scope: 'team', mods: { manaRegen: 1 } },
		{ scope: 'team', mods: { manaRegen: 1.5 } },
		{ scope: 'team', mods: { manaRegen: 2 } },
		{ scope: 'team', mods: { manaRegen: 3 } },
	],
	// 迅捷射手：全队攻速 + 射手叠层 → 全队攻速 + 射手额外攻速
	DA_18_Rapidfire: [
		{ scope: 'team', mods: { attackSpeedPct: 0.1 } },
		{ scope: 'team', mods: { attackSpeedPct: 0.15 } },
		{ scope: 'team', mods: { attackSpeedPct: 0.2 } },
		{ scope: 'team', mods: { attackSpeedPct: 0.3 } },
	],
	// 主宰：全队减伤，主宰更多
	DA_Juggernaut18: [
		{ scope: 'team', mods: { damageReduction: 0.08 } },
		{ scope: 'team', mods: { damageReduction: 0.12 } },
		{ scope: 'team', mods: { damageReduction: 0.18 } },
	],
	// 地狱火：灼烧重伤 → combat 特判 + 羁绊棋子增伤
	DA_18_Inferno: [
		{ scope: 'trait', mods: { damageAmp: 0.05 }, customTag: 'inferno-burn' },
		{ scope: 'trait', mods: { damageAmp: 0.1 }, customTag: 'inferno-burn' },
		{ scope: 'trait', mods: { damageAmp: 0.18 }, customTag: 'inferno-burn' },
		{ scope: 'trait', mods: { damageAmp: 0.3 }, customTag: 'inferno-burn' },
	],
	// 月华神女：月相减伤/增伤 → 全队两者各给
	DA_AluneUniqueTrait18: [
		{ scope: 'team', mods: { damageReduction: 0.1, damageAmp: 0.1 }, customTag: 'alune-moon' },
	],
	// 宿敌：参与击杀叠属性 → 固定 AD/AP 近似
	DA_18_Rival: [
		{ scope: 'trait', mods: { adPct: 0.25, abilityPower: 25 }, customTag: 'rival-takedown' },
		{ scope: 'trait', mods: { adPct: 0.25, abilityPower: 25 }, customTag: 'rival-takedown' },
		{ scope: 'trait', mods: { adPct: 0.45, abilityPower: 45 }, customTag: 'rival-takedown' },
	],
	// 重装战士：开战/低血护盾 → 生命近似
	DA_18_Vanguard: [
		{ scope: 'trait', mods: { maxHpPct: 0.2 } },
		{ scope: 'trait', mods: { maxHpPct: 0.3 } },
		{ scope: 'trait', mods: { maxHpPct: 0.45 } },
	],
	// 斗士：全队生命，斗士额外百分比生命
	DA_18_Brawler: [
		{ scope: 'team', mods: { maxHp: 100 } },
		{ scope: 'team', mods: { maxHp: 200 } },
		{ scope: 'team', mods: { maxHp: 350 } },
	],
	// 黑荆棘：献祭增益 → 羁绊棋子生命
	DA_18_Blackthorn: [
		{ scope: 'trait', mods: { maxHpPct: 0.15 }, customTag: 'blackthorn-sacrifice' },
		{ scope: 'trait', mods: { maxHpPct: 0.3 }, customTag: 'blackthorn-sacrifice' },
		{ scope: 'trait', mods: { maxHpPct: 0.5 }, customTag: 'blackthorn-sacrifice' },
	],
	// 裁决使：技能暴击 + 暴击率
	DA_18_Executioner: [
		{ scope: 'trait', mods: { critChance: 0.2 }, customTag: 'ability-crit' },
		{ scope: 'trait', mods: { critChance: 0.35 }, customTag: 'ability-crit' },
		{ scope: 'trait', mods: { critChance: 0.5 }, customTag: 'ability-crit' },
	],
	// 顶级掠食者：占 2 格 + 峡谷野怪 +2 —— 机制
	DA_18_ApexPredator: [{ scope: 'team', mods: {}, customTag: 'apex-predator' }],
	// 峡谷野怪：印记增益/商店占领 → 羁绊棋子生命+增伤
	DA_Riftbeast18: [
		{ scope: 'trait', mods: { maxHpPct: 0.15, damageAmp: 0.08 }, customTag: 'riftbeast-mark' },
		{ scope: 'trait', mods: { maxHpPct: 0.3, damageAmp: 0.15 }, customTag: 'riftbeast-mark' },
		{ scope: 'trait', mods: { maxHpPct: 0.5, damageAmp: 0.25 }, customTag: 'riftbeast-mark' },
		{ scope: 'trait', mods: { maxHpPct: 0.8, damageAmp: 0.4 }, customTag: 'riftbeast-mark' },
	],
	// 帝王斑蝶：伤害附带双抗击碎 → combat 特判
	DA_18_Caustic: [{ scope: 'trait', mods: { damageAmp: 0.1 }, customTag: 'caustic-shred' }],
	// 花仙子：仙灵提供 AD/AP → 羁绊棋子双系加成
	DA_18_Fae: [
		{ scope: 'trait', mods: { adPct: 0.15, abilityPower: 15 } },
		{ scope: 'trait', mods: { adPct: 0.3, abilityPower: 30 } },
	],
	// 月蚀骑士：自身+邻格攻速/法强 → 羁绊棋子攻速/法强
	DA_18_Lunar: [
		{ scope: 'trait', mods: { attackSpeedPct: 0.15, abilityPower: 15 } },
		{ scope: 'trait', mods: { attackSpeedPct: 0.25, abilityPower: 25 } },
		{ scope: 'trait', mods: { attackSpeedPct: 0.35, abilityPower: 35 } },
		{ scope: 'trait', mods: { attackSpeedPct: 0.5, abilityPower: 50 } },
	],
	// 护卫：全队双抗，护卫更多
	DA_18_Defender: [
		{ scope: 'team', mods: { armor: 15, magicResist: 15 } },
		{ scope: 'team', mods: { armor: 30, magicResist: 30 } },
		{ scope: 'team', mods: { armor: 50, magicResist: 50 } },
	],
	// 法师：全队法强，法师更多
	DA_18_Spellweaver: [
		{ scope: 'team', mods: { abilityPower: 15 } },
		{ scope: 'team', mods: { abilityPower: 30 } },
		{ scope: 'team', mods: { abilityPower: 50 } },
	],
	// 荆棘之兴：植物存活时全队减伤 → 固定减伤近似
	DA_18_ZyraUniqueTrait: [
		{ scope: 'team', mods: { damageReduction: 0.1 }, customTag: 'zyra-plants' },
	],
	// 绝命花妖：击杀回蓝+治疗 → combat 特判 + 增伤
	DA_FloraFatalis18: [
		{ scope: 'trait', mods: { damageAmp: 0.1 }, customTag: 'flora-harvest' },
		{ scope: 'trait', mods: { damageAmp: 0.2 }, customTag: 'flora-harvest' },
	],
	// 召唤师：强化召唤物 → 羁绊棋子生命
	DA_18_Summoner: [
		{ scope: 'trait', mods: { maxHpPct: 0.2 }, customTag: 'summoner-buff' },
		{ scope: 'trait', mods: { maxHpPct: 0.35 }, customTag: 'summoner-buff' },
	],
	// 灵魂莲华：AD/AP/生命成长
	DA_18_Blossom: [
		{ scope: 'trait', mods: { adPct: 0.08, abilityPower: 8, maxHpPct: 0.05 } },
		{ scope: 'trait', mods: { adPct: 0.15, abilityPower: 15, maxHpPct: 0.1 } },
		{ scope: 'trait', mods: { adPct: 0.25, abilityPower: 25, maxHpPct: 0.15 } },
		{ scope: 'trait', mods: { adPct: 0.4, abilityPower: 40, maxHpPct: 0.22 } },
		{ scope: 'trait', mods: { adPct: 0.6, abilityPower: 60, maxHpPct: 0.3 } },
	],
	// 宝石骑士：配对加成 —— 机制
	DA_Emerald18: [{ scope: 'team', mods: {}, customTag: 'taric-pair' }],
}

/** 羁绊棋子额外享受的「更多」档：仅对该羁绊棋子生效的第二层修饰 */
const TRAIT_SELF_BONUS: Record<string, StatMods[]> = {
	DA_18_Invoker: [{ manaRegen: 1 }, { manaRegen: 1.5 }, { manaRegen: 2 }, { manaRegen: 3 }],
	DA_18_Rapidfire: [
		{ attackSpeedPct: 0.15 },
		{ attackSpeedPct: 0.25 },
		{ attackSpeedPct: 0.35 },
		{ attackSpeedPct: 0.5 },
	],
	DA_Juggernaut18: [{ damageReduction: 0.1 }, { damageReduction: 0.15 }, { damageReduction: 0.2 }],
	DA_18_Brawler: [{ maxHpPct: 0.2 }, { maxHpPct: 0.35 }, { maxHpPct: 0.5 }],
	DA_18_Defender: [
		{ armor: 25, magicResist: 25 },
		{ armor: 45, magicResist: 45 },
		{ armor: 70, magicResist: 70 },
	],
	DA_18_Spellweaver: [{ abilityPower: 15 }, { abilityPower: 30 }, { abilityPower: 50 }],
}

/** 把激活羁绊结算到棋子面板（team 全队 + trait 仅羁绊成员 + self 额外层） */
export function applyTraitStats(
	unit: UnitInstance,
	stats: CombatStats,
	active: ActiveTrait[],
): CombatStats {
	const unitTraits = new Set(CHAMPION_BY_API.get(unit.apiName)?.traits ?? [])
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
