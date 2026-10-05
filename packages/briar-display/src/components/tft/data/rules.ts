// TFT S18 规则常量：数值按官方经典表，全部集中此处可调

export const BOARD_COLS = 7
/** 单方放置行数；战斗网格为 BOARD_COLS x COMBAT_ROWS */
export const BOARD_ROWS = 4
export const COMBAT_ROWS = BOARD_ROWS * 2
export const BENCH_SIZE = 9
export const SHOP_SIZE = 5
export const SHOP_REFRESH_COST = 2
export const ITEM_TRAY_SIZE = 10
export const UNIT_MAX_ITEMS = 3
export const MAX_LEVEL = 9
export const STARTING_HP = 100

/** 卡池各费用张数，索引 = 费用 1..5 */
export const POOL_COPIES = [0, 30, 25, 18, 13, 10]

/** 三合一升星：合成下一星所需同星数量 */
export const COMBINE_COUNT = 3

/** 星级倍率（仅 HP 与 AD），索引 = 星级 1..3 */
export const STAR_STAT_MULT = [0, 1, 1.8, 3.24]

/** 商店各费用刷新概率（%），索引 = 等级 1..9 */
export const SHOP_ODDS: number[][] = [
	[0, 0, 0, 0, 0],
	[100, 0, 0, 0, 0],
	[100, 0, 0, 0, 0],
	[75, 25, 0, 0, 0],
	[55, 30, 15, 0, 0],
	[45, 33, 20, 2, 0],
	[30, 40, 25, 5, 0],
	[19, 30, 40, 10, 1],
	[15, 25, 35, 20, 5],
	[10, 20, 25, 35, 10],
]

/** 升级所需 XP，索引 = 当前等级 1..8（1→2 需 2，8→9 需 80） */
export const XP_PER_LEVEL = [0, 2, 2, 6, 10, 20, 36, 56, 80]
export const BUY_XP_COST = 4
export const BUY_XP_AMOUNT = 4

/** 利息：每 10 金 +1，上限 5 */
export const INTEREST_STEP = 10
export const INTEREST_MAX = 5

/** 连胜/连败奖励：场次阈值 → 金币（2~3 场 +1，4 场 +2，5 场及以上 +3） */
export const STREAK_GOLD: [number, number][] = [
	[5, 3],
	[4, 2],
	[2, 1],
]
/** PVP 胜利额外 +1 金 */
export const WIN_GOLD = 1

/** 阶段被动收入：1 阶段按回合（1-1 选秀为 0），2 阶段起每回合 5 */
export const STAGE1_PASSIVE = [0, 0, 2, 2, 3]
export const DEFAULT_PASSIVE = 5

/** 战败扣血：阶段基础值（索引 = stage，7+ 沿用）+ 每个存活敌棋 1 点；对齐官方 2/3/4/6/8/10 */
export const STAGE_BASE_DAMAGE = [0, 0, 2, 3, 4, 6, 8, 10]
export const SURVIVOR_DAMAGE = 1

/** 回合结构：1 阶段 4 回合（1-1 遭遇 + 3 轮 PvE 小兵），其余阶段 7 回合（x-4 选秀、x-7 Boss PvE） */
export const STAGE_ROUNDS = 7
export const STAGE1_ROUNDS = 4
export const CAROUSEL_ROUND = 4

export type RoundType = 'encounter' | 'pve' | 'carousel' | 'pvp'

/** 回合类型唯一事实来源（Stage Tracker / 引擎推进共用） */
export function roundType(stage: number, round: number): RoundType {
	if (stage === 1) return round === 1 ? 'encounter' : 'pve'
	if (round === CAROUSEL_ROUND) return 'carousel'
	if (round === STAGE_ROUNDS) return 'pve'
	return 'pvp'
}

/** 海克斯强化回合（叠加在备战阶段的三选一） */
export const isAugmentRound = (stage: number, round: number): boolean =>
	(stage === 2 && round === 1) || (stage === 3 && round === 2) || (stage === 4 && round === 2)

/** 出售价格 = 费用 x 3^(star-1)（官方全额返还规则） */
export const sellPriceOf = (cost: number, star: number) => cost * 3 ** (star - 1)

/** 战斗节奏 */
export const COMBAT_TICK_MS = 100
export const COMBAT_MAX_SECONDS = 40
export const MANA_PER_ATTACK = 10
/** 受伤回蓝 = 税前伤害 x 系数，单次上限 */
export const MANA_PER_DAMAGE_TAKEN = 0.05
export const MANA_TAKEN_CAP = 42.5
/** 加时赛：超时后双方伤害增幅递增 */
export const OVERTIME_AMP_PER_TICK = 0.05

/** 每回合自动获得经验 */
export const PASSIVE_XP = 2
/** 备战阶段秒数 */
export const PLANNING_SECONDS = 30
/** 选秀每位选择秒数 */
export const CAROUSEL_PICK_SECONDS = 6
/** 战斗播放后缓冲秒数 */
export const COMBAT_BUFFER_SECONDS = 1.5

/** 选秀棋子费用权重（按阶段） */
export const CAROUSEL_COST_WEIGHTS: Record<number, number[]> = {
	1: [70, 30, 0, 0, 0],
	2: [50, 35, 15, 0, 0],
	3: [35, 35, 20, 10, 0],
	4: [25, 30, 25, 15, 5],
}
/** PvE 回合掉落：金币 + 散件数，key 为 `stage-round`（Krugs 起必掉） */
export const PVE_DROPS: Record<string, { gold: number; components: number }> = {
	'1-2': { gold: 2, components: 1 },
	'1-3': { gold: 3, components: 1 },
	'1-4': { gold: 4, components: 2 },
	'2-7': { gold: 4, components: 2 },
	'3-7': { gold: 4, components: 3 },
	'4-7': { gold: 6, components: 3 },
	'5-7': { gold: 8, components: 3 },
	'6-7': { gold: 8, components: 3 },
	'7-7': { gold: 10, components: 3 },
}

/** 1-1 开局遭遇选择秒数 */
export const ENCOUNTER_SECONDS = 12
