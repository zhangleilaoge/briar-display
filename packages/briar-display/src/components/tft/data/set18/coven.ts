// 魔女精粹兑换奖励表：阈值取自官方数据（tftips.app 收菜表），
// 战利品中纹章/宝箱/冠冕/复制器等引擎不存在的物件近似映射为成装/金币/棋子
export interface CovenReward {
	gold?: number
	/** 随机基础装备件数 */
	components?: number
	/** 随机成装件数 */
	crafted?: number
	removers?: number
	rerollers?: number
	/** 指定棋子（按中文名）x 数量 */
	champs?: { name: string; count: number }[]
	/** 随机 N 费棋子 x 数量 */
	randomCost?: { cost: number; count: number }[]
}

export interface CovenTier {
	essence: number
	options: { weight: number; reward: CovenReward }[]
}

export const COVEN_TIERS: CovenTier[] = [
	{
		essence: 40,
		options: [
			{ weight: 1, reward: { gold: 4 } },
			{ weight: 1, reward: { randomCost: [{ cost: 2, count: 2 }] } },
			{
				weight: 1,
				reward: {
					champs: [
						{ name: '卡西奥佩娅', count: 1 },
						{ name: '卡蜜尔', count: 1 },
					],
				},
			},
		],
	},
	{
		essence: 85,
		options: [
			{ weight: 1, reward: { gold: 2, components: 1 } },
			{ weight: 1, reward: { gold: 10 } },
			{ weight: 1, reward: { champs: [{ name: '伊莉丝', count: 1 }], components: 1 } },
		],
	},
	{
		essence: 130,
		options: [
			{ weight: 1, reward: { components: 2 } },
			{
				weight: 1,
				reward: {
					champs: [
						{ name: '伊莉丝', count: 3 },
						{ name: '卡西奥佩娅', count: 1 },
					],
					components: 1,
				},
			},
			{ weight: 1, reward: { gold: 3, crafted: 1 } },
		],
	},
	{
		essence: 185,
		options: [
			{ weight: 1, reward: { crafted: 1, components: 1 } },
			{ weight: 1, reward: { gold: 8, crafted: 1 } },
			{ weight: 1, reward: { gold: 10, rerollers: 1, components: 2 } },
		],
	},
	{
		essence: 250,
		options: [
			{ weight: 1, reward: { crafted: 2, gold: 12 } },
			{
				weight: 1,
				reward: { crafted: 1, components: 1, champs: [{ name: '莫甘娜', count: 3 }], gold: 5 },
			},
			{ weight: 1, reward: { crafted: 2, gold: 6, rerollers: 1 } },
			{
				weight: 1,
				reward: { champs: [{ name: '拉克丝', count: 1 }], components: 2, crafted: 1, gold: 5 },
			},
			{ weight: 1, reward: { gold: 5, crafted: 2 } },
		],
	},
	{
		essence: 365,
		options: [
			{ weight: 1, reward: { gold: 15, crafted: 2, removers: 2, rerollers: 2 } },
			{ weight: 1, reward: { crafted: 2, champs: [{ name: '莫甘娜', count: 3 }], gold: 10 } },
			{ weight: 1, reward: { gold: 20, crafted: 2, removers: 3 } },
		],
	},
	{
		essence: 500,
		options: [
			{ weight: 1, reward: { crafted: 3, removers: 3, rerollers: 3 } },
			{ weight: 1, reward: { crafted: 2, gold: 20, randomCost: [{ cost: 5, count: 3 }] } },
			{ weight: 1, reward: { gold: 10, crafted: 4 } },
		],
	},
	{
		essence: 650,
		options: [
			{ weight: 1, reward: { gold: 30, crafted: 3, randomCost: [{ cost: 5, count: 3 }] } },
			{
				weight: 1,
				reward: {
					crafted: 3,
					gold: 10,
					champs: [
						{ name: '莫甘娜', count: 3 },
						{ name: '拉克丝', count: 1 },
					],
				},
			},
			{ weight: 1, reward: { gold: 40, crafted: 3, rerollers: 2 } },
		],
	},
	{
		essence: 800,
		options: [
			{ weight: 1, reward: { gold: 100, crafted: 6 } },
			{ weight: 1, reward: { gold: 100, crafted: 6, randomCost: [{ cost: 5, count: 3 }] } },
		],
	},
]
