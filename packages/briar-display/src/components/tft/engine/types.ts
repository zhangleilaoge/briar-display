export interface HexPos {
	col: number
	row: number
}

export type StarLevel = 1 | 2 | 3

export interface UnitInstance {
	uid: string
	apiName: string
	star: StarLevel
	/** 装备 apiName，最多 UNIT_MAX_ITEMS 件 */
	items: string[]
}

/** 摆上了棋盘的棋子（pos 为 0..3 行放置坐标） */
export interface BoardUnit extends UnitInstance {
	pos: HexPos
}

export type Phase = 'lobby' | 'encounter' | 'carousel' | 'planning' | 'combat' | 'ended'

export interface RoundRef {
	stage: number
	round: number
}

export type StreakType = 'win' | 'loss' | 'none'

export interface PlayerState {
	id: number
	name: string
	isBot: boolean
	hp: number
	gold: number
	xp: number
	level: number
	streakType: StreakType
	streakCount: number
	bench: (UnitInstance | null)[]
	board: BoardUnit[]
	itemTray: string[]
	shop: (string | null)[]
	shopLocked: boolean
	alive: boolean
	placement: number
	lastOpponentId: number | null
	/** 已选海克斯/遭遇恩赐 apiName */
	augments: string[]
	/** 海克斯给的每回合免费刷新次数（备战阶段发放） */
	freeRerolls: number
}

/** 结算完星级/装备/羁绊后的战斗面板 */
export interface CombatStats {
	maxHp: number
	attackDamage: number
	abilityPower: number
	attackSpeed: number
	armor: number
	magicResist: number
	mana: number
	initialMana: number
	range: number
	critChance: number
	critMultiplier: number
	/** 每秒法力回复（神谕等） */
	manaRegen: number
	/** 伤害增幅（乘区） */
	damageAmp: number
	/** 伤害减免（乘区） */
	damageReduction: number
	/** 全能吸血（造成伤害按比例回血） */
	omnivamp: number
}

export const emptyCombatStats = (): CombatStats => ({
	maxHp: 0,
	attackDamage: 0,
	abilityPower: 0,
	attackSpeed: 0,
	armor: 0,
	magicResist: 0,
	mana: 0,
	initialMana: 0,
	range: 1,
	critChance: 0,
	critMultiplier: 1,
	manaRegen: 0,
	damageAmp: 0,
	damageReduction: 0,
	omnivamp: 0,
})
