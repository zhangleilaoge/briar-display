import type { CombatStats } from './types'

/** 装备/羁绊通用的属性修饰；pct 后缀为小数比例（0.35 = +35%） */
export interface StatMods {
	maxHp?: number
	maxHpPct?: number
	adPct?: number
	abilityPower?: number
	attackSpeedPct?: number
	armor?: number
	magicResist?: number
	critChance?: number
	initialMana?: number
	manaRegen?: number
	damageAmp?: number
	damageReduction?: number
	omnivamp?: number
}

export function applyMods(stats: CombatStats, mods: StatMods): void {
	if (mods.maxHp) stats.maxHp += mods.maxHp
	if (mods.maxHpPct) stats.maxHp *= 1 + mods.maxHpPct
	if (mods.adPct) stats.attackDamage *= 1 + mods.adPct
	if (mods.abilityPower) stats.abilityPower += mods.abilityPower
	if (mods.attackSpeedPct) stats.attackSpeed *= 1 + mods.attackSpeedPct
	if (mods.armor) stats.armor += mods.armor
	if (mods.magicResist) stats.magicResist += mods.magicResist
	if (mods.critChance) stats.critChance += mods.critChance
	if (mods.initialMana) stats.initialMana += mods.initialMana
	if (mods.manaRegen) stats.manaRegen += mods.manaRegen
	if (mods.damageAmp) stats.damageAmp += mods.damageAmp
	if (mods.damageReduction) stats.damageReduction += mods.damageReduction
	if (mods.omnivamp) stats.omnivamp += mods.omnivamp
}
