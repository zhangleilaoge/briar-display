// 由 packages/briar-scripts/src/tft-set18/fetch.ts 生成，勿手改
export interface ChampionStats {
	armor: number
	attackSpeed: number
	critChance: number
	critMultiplier: number
	damage: number
	hp: number
	initialMana: number
	magicResist: number
	mana: number
	range: number
}

export interface SetAbility {
	name: string
	desc: string
	/** 技能变量，数组前 3 个为 1/2/3 星数值 */
	vars: Record<string, number[]>
}

export interface SetChampion {
	apiName: string
	name: string
	cost: number
	/** 羁绊 apiName 列表 */
	traits: string[]
	stats: ChampionStats
	ability: SetAbility
	icon: string
}

export interface SetTrait {
	apiName: string
	name: string
	desc: string
	/** 各档位最小棋子数 */
	breakpoints: number[]
	/** 与 breakpoints 一一对应，每档位的变量表 */
	vars: Record<string, number>[]
	icon: string
}

export interface SetItem {
	apiName: string
	name: string
	desc: string
	effects: Record<string, number>
	isComponent: boolean
	/** 合成配方（散件 apiName），散件本身为空数组 */
	composition: string[]
	icon: string
	/** 纹章：装备后计入的羁绊 apiName */
	grantsTrait?: string
	/** 神器（奥恩）：不可合成 */
	isArtifact?: boolean
	/** 光明武器：不可合成 */
	isRadiant?: boolean
}

export type AbilityKind =
	| 'strike'
	| 'aoe'
	| 'heal'
	| 'shield'
	| 'buff'
	| 'dash'
	| 'summon'
	| 'dot'
	| 'transform'

export interface AbilityArchetype {
	kind: AbilityKind
	params: Record<string, number[]>
}
