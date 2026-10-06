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
	/** 阿尔法印记（峡谷野怪消耗品赋予的独特增益） */
	alphaMark?: boolean
	/** 拉克丝（大元素使）选定的羁绊：计为该羁绊 +2 */
	chosenTrait?: string
	/** 永久生命加成（金色炊具等按单位累计） */
	bonusHpFlat?: number
	/** 覆盖基础最大生命（假人化：失去棋子总血量的比例值） */
	hpOverride?: number
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
	/** 地狱火引燃的商店槽位（当前商店内高一费棋子） */
	ignitedSlots: number[]
	/** 峡谷野怪(5)：距上次商店占领的玩家对战计数 */
	riftbeastCombats: number
	/** 魔女精粹（-1 = 未激活；激活时置为初始 40） */
	covenEssence: number
	/** 魔女已兑换次数（决定下一档奖励所需精粹） */
	covenCashouts: number
	/** 购买自然仙灵等海克斯累计的全队生命值加成 */
	bonusMaxHpFlat: number
	/** 远古树精跨战斗累计叠层（每层 +30 永久最大生命，作用于最强茂凯） */
	maokaiStacks: number
	/** 宿敌跨战斗累计参与击杀数（雷恩加尔每 2 次提供金币） */
	rivalTakedowns: number
	/** 待处理的武器库（锻造器 N 选一）；source 用于弹窗标题，chain 为选完后的连锁发放 */
	armory: {
		pool: import('../data/set18/augments').ArmoryPool
		options: string[]
		source: string
		chain?: import('../data/set18/augments').ArmoryChain
	} | null
	/** 排队中的武器库（当前武器库选完后依次补上） */
	armoryQueue: {
		pool: import('../data/set18/augments').ArmoryPool
		options: string[]
		source: string
		chain?: import('../data/set18/augments').ArmoryChain
	}[]
	/** 海克斯计数器/备忘（活体锻炉回合数、硬性承诺纹章羁绊、阈值已触发等） */
	augMemo: Record<string, number | string>
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

export interface CarouselSlot {
	apiName: string
	item: string
}

export interface CombatRecord {
	opponentId: number
	opponentName: string
	isGhost: boolean
	isPvE: boolean
	/** 本玩家视角的 side */
	playerSide: 'A' | 'B'
	result: import('./combat').CombatResult
	/** 开战时的双方输入（UI 回放初始帧） */
	inputsA: import('./combat').CombatUnitInput[]
	inputsB: import('./combat').CombatUnitInput[]
}

export interface GameState {
	phase: Phase
	stage: number
	round: number
	gameTime: number
	phaseEndsAt: number
	players: PlayerState[]
	winnerId: number | null
	carousel: CarouselSlot[]
	carouselQueue: number[]
	currentPickerIndex: number
	pickEndsAt: number
	combats: Map<number, CombatRecord>
	/** 战斗阶段开始的 gameTime（UI 回放锚点） */
	combatStartAt: number
	/** 每个 bot 下一次行动的 gameTime */
	botActAt: Map<number, number>
	/** PvE 回合备战阶段预生成并展示的野怪波次（开战时直接使用同一波） */
	pveWave: import('./combat').CombatUnitInput[] | null
	/** 海克斯/遭遇三选一：pid → 候选 apiName；选完即从 map 删除 */
	augmentOffers: Map<number, string[]>
	/** 1-1 开局遭遇 apiName（全场随机一个，直接生效） */
	encounterApi: string | null
}
