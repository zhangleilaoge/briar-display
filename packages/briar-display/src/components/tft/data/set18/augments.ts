// 海克斯强化：名称/描述/数值取自 CommunityDragon 官方数据（TFT_Augment_*），
// 效果近似映射到引擎支持的种类（与技能同策略：官方描述 + 引擎近似实现）
export type AugmentEffect =
	| { kind: 'goldNow'; amount: number }
	| { kind: 'xpNow'; amount: number }
	| { kind: 'components'; count: number }
	| { kind: 'freeRerolls'; perRound: number }
	| { kind: 'interestCap'; add: number }
	| { kind: 'winGold'; amount: number }
	| { kind: 'lossGold'; amount: number }
	| { kind: 'stageGold'; amount: number }
	| { kind: 'roundGold'; amount: number }
	| { kind: 'teamBuff'; adPct?: number; ap?: number; hpPct?: number; asPct?: number }
	| { kind: 'unitWithItem'; cost: number }

export interface AugmentDef {
	/** 官方 apiName（TFT_Augment_* / ENC_* 自定义遭遇） */
	apiName: string
	name: string
	desc: string
	/** 1 银 / 2 金 / 3 彩，影响边框色 */
	tier: 1 | 2 | 3
	effects: AugmentEffect[]
}

const A = (
	apiName: string,
	name: string,
	desc: string,
	tier: 1 | 2 | 3,
	effects: AugmentEffect[],
): AugmentDef => ({ apiName, name, desc, tier, effects })

/** 海克斯池（2-1/3-2/4-2 各随机 3 个，不重复已选）；描述为官方文本，近似处以描述为准 */
export const AUGMENTS: AugmentDef[] = [
	// ---- 白银 ----
	A('TFT_Augment_CognitiveTax', '认知税', '获得8金币和1经验值。', 1, [
		{ kind: 'goldNow', amount: 8 },
		{ kind: 'xpNow', amount: 1 },
	]),
	A('TFT_Augment_Placebo', '安慰剂', '你的弈子们获得1%攻击速度。获得8金币。', 1, [
		{ kind: 'teamBuff', asPct: 0.01 },
		{ kind: 'goldNow', amount: 8 },
	]),
	A('TFT_Augment_Kingslayer', '弑君突刺', '每场玩家对战回合获胜后，获得1金币。', 1, [
		{ kind: 'winGold', amount: 1 },
	]),
	A('TFT_Augment_MarksMan', '集中火力', '你的队伍获得10%物理加成。每5秒，额外获得5%。', 1, [
		{ kind: 'teamBuff', adPct: 0.1 },
	]),
	// ---- 黄金 ----
	A('TFT_Augment_CognitiveTaxPlus', '认知税+', '获得12金币和3经验值。', 2, [
		{ kind: 'goldNow', amount: 12 },
		{ kind: 'xpNow', amount: 3 },
	]),
	A('TFT_Augment_PlaceboPlus', '安慰剂+', '你的弈子们获得1%攻击速度。获得14金币。', 2, [
		{ kind: 'teamBuff', asPct: 0.01 },
		{ kind: 'goldNow', amount: 14 },
	]),
	A('TFT_Augment_SmallGrabBag', '小小福袋', '提供2件随机基础装备。', 2, [
		{ kind: 'components', count: 2 },
	]),
	A('TFT_Augment_PatienceIsAVirtue', '耐心是一种美德', '每回合获得1次免费商店刷新。', 2, [
		{ kind: 'freeRerolls', perRound: 1 },
	]),
	A('TFT_Augment_InvestmentStrategy2', '投资策略 II', '你的最大利息提升至7金币。获得3金币。', 2, [
		{ kind: 'interestCap', add: 2 },
		{ kind: 'goldNow', amount: 3 },
	]),
	A('TFT_Augment_ShojinSpirit', '长矛意志', '你的队伍获得8%物理加成。获得2件随机基础装备。', 2, [
		{ kind: 'teamBuff', adPct: 0.08 },
		{ kind: 'components', count: 2 },
	]),
	A('TFT_Augment_MoneyHungry', '贪财', '立刻获得7金币，然后在每个阶段开始时获得7金币。', 2, [
		{ kind: 'goldNow', amount: 7 },
		{ kind: 'stageGold', amount: 7 },
	]),
	A('TFT_Augment_GainGold', '获得金币', '获得21金币。', 2, [{ kind: 'goldNow', amount: 21 }]),
	// ---- 棱彩 ----
	A('TFT_Augment_MinMaxer', '可大可小', '获得4个随机基础装备。', 3, [
		{ kind: 'components', count: 4 },
	]),
	A('TFT_Augment_MoneyMonsoon', '摇钱树', '立刻并在剩余游戏时间内每回合获得7金币。', 3, [
		{ kind: 'goldNow', amount: 7 },
		{ kind: 'roundGold', amount: 7 },
	]),
	A('TFT_Augment_GrowthMindset', '成长型思维', '获得50经验值。', 3, [
		{ kind: 'xpNow', amount: 50 },
	]),
	A('TFT_Augment_GiantAndMighty', '大而有力', '你的队伍体型变大，获得10%最大生命值。', 3, [
		{ kind: 'teamBuff', hpPct: 0.1 },
	]),
	A('TFT_Augment_CalculatedEnhancement', '精心赋能', '你的弈子们获得40%物理加成和50法术加成。', 3, [
		{ kind: 'teamBuff', adPct: 0.4, ap: 50 },
	]),
]

/** 1-1 开局遭遇池（自定义）：保证 1-2 有兵力来源 */
export const ENCOUNTERS: AugmentDef[] = [
	A('ENC_UNIT', '神赐棋子', '获得 1 个随机 1 费棋子和 1 件随机基础装备。', 2, [
		{ kind: 'unitWithItem', cost: 1 },
	]),
	A('ENC_GOLD', '启动资金', '立刻获得 6 金币。', 1, [{ kind: 'goldNow', amount: 6 }]),
	A('ENC_XP', '先声夺人', '立刻获得 6 点经验值。', 1, [{ kind: 'xpNow', amount: 6 }]),
]

export const AUGMENT_BY_API = new Map([...AUGMENTS, ...ENCOUNTERS].map((a) => [a.apiName, a]))
