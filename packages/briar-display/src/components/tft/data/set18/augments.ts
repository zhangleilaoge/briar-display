// 海克斯强化：名称/描述/数值取自 CommunityDragon 官方数据（S18 池 = setData[1].augments），
// 只收录效果能完整映射到引擎的海克斯（官方描述 + 引擎等价实现）
export type AugmentEffect =
	| { kind: 'goldNow'; amount: number }
	| { kind: 'xpNow'; amount: number }
	| { kind: 'components'; count: number }
	/** 相同基础装备 N 件 */
	| { kind: 'componentsSame'; count: number }
	| { kind: 'freeRerolls'; perRound: number }
	/** 一次性刷新次数（当回合有效） */
	| { kind: 'rerollsNow'; count: number }
	| { kind: 'interestCap'; add: number }
	| { kind: 'winGold'; amount: number }
	| { kind: 'lossGold'; amount: number }
	| { kind: 'stageGold'; amount: number }
	| { kind: 'roundGold'; amount: number }
	| {
			kind: 'teamBuff'
			adPct?: number
			ap?: number
			apPct?: number
			hpPct?: number
			asPct?: number
			hpFlat?: number
			armor?: number
			mr?: number
			/** 初始法力（成吨的属性系） */
			mana?: number
			/** 暴击几率（权杖意志/珠光莲花） */
			critChance?: number
			critMult?: number
			/** 伤害增幅（乘区，飞升类常驻版） */
			damageAmp?: number
			damageReduction?: number
			omnivamp?: number
			manaRegen?: number
			/** 全队技能可暴击（珠光莲花） */
			abilityCrit?: boolean
	  }
	| { kind: 'teamHpPerInterest'; amount: number }
	| { kind: 'unitWithItem'; cost: number }
	/** 随机 N 费棋子（star 缺省 1） */
	| { kind: 'randomChamps'; cost: number; count: number; star?: number }
	/** 指定棋子（按中文名） */
	| { kind: 'namedChamps'; champs: { name: string; count: number }[] }
	| {
			kind: 'consumablesNow'
			removers?: number
			rerollers?: number
			/** 英雄复制器（任意费用） */
			duplicators?: number
			/** 次级英雄复制器（仅 3 费及以下） */
			lesserDuplicators?: number
	  }
	| { kind: 'streakWin'; count: number }
	/** 战斗开始：最前排每个己方弈子为全队提供生命 */
	| { kind: 'hpPerFrontRow'; amount: number }
	/** 战斗开始：前两排每个己方弈子为全队提供双抗 */
	| { kind: 'resistsPerFrontRow'; amount: number }
	| { kind: 'resistsPerLevel'; base: number; perLevel: number }
	/** 随机获得一个该品质海克斯（命运系列，不可再抽到命运） */
	| { kind: 'randomAugment'; tier: 1 | 2 | 3 }
	| { kind: 'goldCoinFlip'; amount: number }
	/** 购买【自然仙灵】(灵魂莲华)棋子时触发 */
	| { kind: 'onBuyBlossom'; gold?: number; hpFlat?: number }
	/** 额外可标记的阿尔法印记数量（欧米茄之怪） */
	| { kind: 'alphaMarkExtra'; count: number }
	/** 武器库（锻造器 N 选一弹窗）；options 为选项数（缺省 4）；chain=选完后连锁发放（套娃系列） */
	| { kind: 'armoryNow'; pool: ArmoryPool; options?: number; chain?: ArmoryChain }
	/** 每 N 场玩家对战回合后开启武器库（可重复，活体锻炉） */
	| { kind: 'armoryPerRounds'; pool: ArmoryPool; rounds: number }
	/** N 场玩家对战回合后开启武器库（一次性，休眠锻炉） */
	| { kind: 'armoryAfterRounds'; pool: ArmoryPool; rounds: number }
	/** 到达指定等级时触发（游神的眷顾=武器库；后期专家=金币；生日礼物=每次升级），已越过的等级可追溯 */
	| {
			kind: 'armoryAtLevels'
			pool?: ArmoryPool
			levels: number[]
			/** 到达等级时给金币（后期专家） */
			gold?: number
			/** 每次升级都触发（生日礼物；首次检查时以当前等级为基准，不补发） */
			everyLevel?: boolean
			/** 每次升级发随机弈子：费用=等级-costOffset（下限 1，上限 maxCost），指定 star */
			levelChamp?: { star: number; costOffset: number; maxCost: number }
	  }
	/** N 场玩家对战回合后直接随机获得物品（repeat=每 N 场重复；times=最多发放次数，缺省不限） */
	| {
			kind: 'delayRandom'
			rounds: number
			repeat?: boolean
			times?: number
			artifacts?: number
			components?: number
			completed?: number
			emblems?: number
			gold?: number
			/** 经验值（爆炸式增长：xpNow + 每回合开始的 XP 用 rounds:1/repeat/times 建模） */
			xp?: number
			/** 指定装备直接入装备栏（锅铲厨房的金锅铲冠冕/窃贼帮派 II 的手套） */
			items?: string[]
			duplicators?: number
			lesserDuplicators?: number
			/** 随机 N 费弈子（弈子配送） */
			champs?: { cost: number; count: number; star?: number }[]
	  }
	| { kind: 'randomArtifacts'; count: number }
	| { kind: 'randomCompleted'; count: number }
	| { kind: 'randomEmblems'; count: number }
	/** 指定装备直接入装备栏 */
	| { kind: 'namedItems'; apiNames: string[] }
	/** 训练假人入备战席（big=高塔巨型假人，带周期电击） */
	| { kind: 'dummyNow'; count: number; big?: boolean }
	/** 战斗中己方假人每存活 N 秒提供金币（假人金币） */
	| { kind: 'dummyGold'; perSeconds: number; amount: number }
	/** 碰撞测试假人：开战发射至敌群并晕眩 stun 秒（作用于全部己方假人） */
	| { kind: 'crashTest'; stun: number }
	/** 替罪羊：假人全队最先阵亡时获得金币（仅 PvP 结算） */
	| { kind: 'scapegoatGold'; amount: number }
	/** 队伍按已携带装备数获得生命（甜点） */
	| { kind: 'teamHpPerItem'; amount: number }
	/** 队伍按已携带纹章数获得生命（灵活摇摆） */
	| { kind: 'teamHpPerEmblem'; amount: number }
	/** 携带特定装备/装备数的棋子获得加成（加冕礼=冠冕系，厨神阿福=铲锅系，源计划=1 件装备，正义报复=指定装备） */
	| {
			kind: 'holderBuff'
			/** 装备系列匹配（加冕礼=冠冕系，厨神阿福=铲锅系）；item/itemCount 优先 */
			match?: 'crown' | 'spatPan'
			/** 指定装备 apiName 精确匹配（携带者加成系） */
			item?: string
			/** 装备件数要求（源计划系列=恰好 1 件） */
			itemCount?: number
			asPct?: number
			adPct?: number
			apPct?: number
			ap?: number
			hpFlat?: number
			armor?: number
			mr?: number
			manaRegen?: number
			critChance?: number
			damageAmp?: number
			damageReduction?: number
			omnivamp?: number
			/** 携带者获得技能暴击（正义报复） */
			abilityCrit?: boolean
	  }
	/** 出售弈子时其成装拆成基础装备（打捞桶；冠冕/纹章除外） */
	| { kind: 'salvageSplit' }
	/** 首次降至指定生命值时获得物品（神力天铸） */
	| {
			kind: 'hpThresholdItems'
			hp: number
			artifacts?: number
			completed?: number
			components?: number
	  }
	/** 每阶段开始时获得 1 个随机纹章（灵活摇摆） */
	| { kind: 'stageEmblem' }
	/** 立刻及每阶段开始获得所持纹章羁绊的 1 星棋子，费用=当前阶段数（硬性承诺） */
	| { kind: 'stageEmblemChamp'; gold: number }
	/** 每回合开始铲锅系携带者为最近的友军提供永久生命（金色炊具） */
	| { kind: 'roundStartSpatHp'; amount: number }
	/** 随机 N 费棋子 + 一个与其羁绊匹配的纹章（蓝图系列） */
	| { kind: 'champWithEmblem'; cost: number; star?: number }
	/** 与所持纹章同羁绊的友军获得攻击速度（水乳交融） */
	| { kind: 'emblemSynergyBuff'; asPct: number }
	/** 随机光明武器 N 件（光明武器池） */
	| { kind: 'randomRadiant'; count: number }
	/** 黄金赌约：先给金币再抛硬币——正面得光明武器库，反面得 N 个成装锻造器 */
	| { kind: 'coinFlipArmory'; gold: number; tailsPool: ArmoryPool; tailsCount: number }
	/** 潘朵拉的装备：每回合开始装备栏装备按同类随机变化（消耗品/铲锅/冠冕除外） */
	| { kind: 'pandoraTray' }
	/** 创世神：开一个 3 选 1 羁绊武器库，选定后获得该羁绊的拉克丝（+2 计数）与朔极之矛 */
	| { kind: 'luxCreator' }
	/** 假人化：失去棋盘与备战席全部棋子，获得血量为其总血量 hpPct 的训练假人 + 随机 2 星 2 费非坦克棋子 */
	| { kind: 'dummify'; hpPct: number }
	/** 假人背包：假人可携带装备并使用装备类消耗品 */
	| { kind: 'dummiesCanEquip' }
	/** 携带指定羁绊纹章的弈子从该羁绊获得额外效能（致命丽花） */
	| { kind: 'emblemTraitAmp'; trait: string; pct: number }
	/** 条件团队加成：按单位站位/装备状态在战斗面板结算（应急护甲=无装备/玻璃大炮=后排/浪人=无邻格友军/C位的觉悟=前排中心/双子守护神=前排仅N个） */
	| {
			kind: 'condBuff'
			when: 'noItems' | 'backRow' | 'noNeighborAlly' | 'frontRowOnly' | 'frontCenter'
			/** frontRowOnly 用：第一排恰好 N 个时这些弈子获得加成 */
			frontCount?: number
			adPct?: number
			apPct?: number
			asPct?: number
			armor?: number
			mr?: number
			hpFlat?: number
			/** 负值为惩罚（玻璃大炮最大生命降低） */
			hpPct?: number
			damageAmp?: number
			damageReduction?: number
			omnivamp?: number
			critChance?: number
			/** 战斗开始护盾（最大生命比例；引擎护盾无持续时间，近似） */
			shieldPct?: number
	  }
	/** 每回合成长叠加的团队加成（打气=攻速/猛将的荣耀=物法/宝宝学院=物法）；counter 存 augMemo */
	| {
			kind: 'rampBuff'
			/** 触发节奏：round=每个回合 / pvp=仅玩家对战回合 */
			per: 'round' | 'pvp'
			asPct?: number
			adPct?: number
			apPct?: number
			hpFlat?: number
			/** 初始层数（猛将的荣耀等） */
			initialStacks?: number
			/** 层数上限（缺省不限） */
			maxStacks?: number
	  }
	/** 回合结束条件经验（清晰头脑=备战席空/纷乱头脑=备战席满/物尽其用=备战席无装备） */
	| { kind: 'roundEndXp'; when: 'benchEmpty' | 'benchFull' | 'benchNoItems'; amount: number }
	/** 玩家对战结算经验（耐心学习：胜 win / 负 lose） */
	| { kind: 'combatResultXp'; win: number; lose: number }
	/** 玩家生命立刻提升（小巨人/巨型泰坦） */
	| { kind: 'playerHp'; amount: number }
	/** 不再获得利息（花到上头/遥遥领先） */
	| { kind: 'noInterest' }
	/** 玩家对战回合开始获得金币（花到上头） */
	| { kind: 'roundStartGold'; amount: number }
	/** 每个回合开始获得经验值（遥遥领先） */
	| { kind: 'roundStartXp'; amount: number }
	/** 购买经验值时额外获得（升级咯！） */
	| { kind: 'buyXpBonus'; amount: number }
	/** 购买经验费用折扣（上进心，单位金币） */
	| { kind: 'xpCostDiscount'; amount: number }
	/** 每次升级时：生命 + 刷新次数（+每级额外次数，大买特买=等级+1） */
	| {
			kind: 'levelUpBonus'
			hp?: number
			rerolls?: number
			/** 每级额外刷新次数（大买特买：等级数+1 次 → rerollsPerLevel=1, rerolls=1） */
			rerollsPerLevel?: number
	  }
	/** 值得等待：随机 N 费弈子（记名），每回合开始获得其 1 星复制体 */
	| { kind: 'worthTheWait'; cost: number; copies: number }
	/** 立刻及每阶段开始获得经验值与免费刷新（新纪元） */
	| { kind: 'stageKit'; xp?: number; rerolls?: number }
	/** 战斗内计时增益：every=每 after 秒重复（发条增速器），缺省一次性（飞升系列） */
	| {
			kind: 'combatTimer'
			after: number
			every?: boolean
			damageAmp?: number
			asPct?: number
	  }
	/** 敌方弈子阵亡时治疗最近的友军（治疗法球） */
	| { kind: 'deathHeal'; amount: number }
	/** 敌方弈子被击杀时概率掉落金币（战争财宝；官方为战利品表，近似为 1 金） */
	| { kind: 'killLoot'; chance: number }
	/** 对敌方小小英雄造成 target 点伤害后获得宝箱（征战之路） */
	| {
			kind: 'playerDamageQuest'
			target: number
			champCount: number
			minCost: number
			itemCount: number
	  }
	/** 每次商店刷新队伍获得永久生命（大刷特刷） */
	| { kind: 'rerollRamp'; hpFlat: number }

/** 武器库选项池（trait = 拉克丝大元素使的羁绊选择） */
export type ArmoryPool = 'artifact' | 'component' | 'completed' | 'emblem' | 'radiant' | 'trait'

/** 武器库连锁发放：pool=再开一个对应池的武器库（可再带 chain 形成链），gold=直接发金币 */
export interface ArmoryChain {
	pool?: ArmoryPool
	gold?: number
}

export interface AugmentDef {
	/** 官方 apiName（TFT_Augment_* / DA_* / ENC_* 自定义遭遇） */
	apiName: string
	name: string
	desc: string
	/** 1 银 / 2 金 / 3 彩，影响边框色 */
	tier: 1 | 2 | 3
	effects: AugmentEffect[]
	/** PVE/特殊模式专属（Plus 强化版），不参与常规 2-1/3-2/4-2 随机抽取 */
	pveOnly?: boolean
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
	A('TFT_Augment_MarksMan', '集中火力', '你的队伍获得10%物理加成。每5秒，额外获得5%。', 1, [
		{ kind: 'teamBuff', adPct: 0.1 },
	]),
	A('TFT_Augment_CalledShot', '进攻宣告', '将你的连胜数设为4。获得4金币。', 1, [
		{ kind: 'goldNow', amount: 4 },
		{ kind: 'streakWin', count: 4 },
	]),
	A(
		'TFT_Augment_BoxingLessons',
		'拳击课程',
		'战斗开始时，前排每有1个己方弈子，你的队伍获得30生命值。',
		1,
		[{ kind: 'hpPerFrontRow', amount: 30 }],
	),
	A(
		'TFT_Augment_Lineup',
		'列队',
		'战斗开始时，前两排每有一个己方弈子，你的队伍获得2护甲和魔法抗性。',
		1,
		[{ kind: 'resistsPerFrontRow', amount: 2 }],
	),
	A('TFT_Augment_KickStart', '博弈开启', '获得1个随机2星2费弈子和1金币。', 1, [
		{ kind: 'randomChamps', cost: 2, count: 1, star: 2 },
		{ kind: 'goldNow', amount: 1 },
	]),
	A(
		'TFT_Augment_FeelingLucky',
		'手气不错',
		'获得12金币，然后抛硬币。如果硬币正面朝上，另外获得4金币。',
		1,
		[
			{ kind: 'goldNow', amount: 12 },
			{ kind: 'goldCoinFlip', amount: 4 },
		],
	),
	A('TFT_Augment_SilverDestiny', '白银命运', '获得1个随机白银阶强化符文和2金币。', 1, [
		{ kind: 'randomAugment', tier: 1 },
		{ kind: 'goldNow', amount: 2 },
	]),
	A('DA_18_OnesTwosThree', '一一二三', '获得2个1费弈子、1个2费弈子和1个3费弈子。', 1, [
		{ kind: 'randomChamps', cost: 1, count: 2 },
		{ kind: 'randomChamps', cost: 2, count: 1 },
		{ kind: 'randomChamps', cost: 3, count: 1 },
	]),
	A(
		'DA_18_ResidualMagic',
		'残留魔力',
		'你的队伍获得60生命值。你每次购买【自然仙灵】，都会将该加成提升10。',
		1,
		[
			{ kind: 'teamBuff', hpFlat: 60 },
			{ kind: 'onBuyBlossom', hpFlat: 10 },
		],
	),
	A('DA_IronAssets', '黑铁资产', '获得1个【基础装备锻造器】和3金币。', 1, [
		{ kind: 'armoryNow', pool: 'component' },
		{ kind: 'goldNow', amount: 3 },
	]),
	A('DA_LatentForge', '休眠锻炉', '在8场玩家对战回合后，获得1个【神器锻造器】。', 1, [
		{ kind: 'armoryAfterRounds', pool: 'artifact', rounds: 8 },
	]),
	A(
		'DA_SalvageBin',
		'打捞桶',
		'立刻获得1件随机成装，并在8场玩家对战回合后获得1件基础装备。出售弈子会将其携带的成装拆分成基础装备(冠冕系装备和纹章除外)。',
		1,
		[
			{ kind: 'randomCompleted', count: 1 },
			{ kind: 'delayRandom', rounds: 8, components: 1 },
			{ kind: 'salvageSplit' },
		],
	),
	A('DA_18_BranchingOut', '节外生枝', '获得1个随机纹章。', 1, [
		{ kind: 'randomEmblems', count: 1 },
	]),
	A(
		'DA_NestingAnvils',
		'锻造器套娃',
		'获得1个【神器锻造器】。在你开启它之后，获得1个【基础装备锻造器】。开启这个【基础装备锻造器】后，又获得4金币。',
		1,
		[{ kind: 'armoryNow', pool: 'artifact', chain: { pool: 'component', gold: 4 } }],
	),
	A(
		'DA_Dummify',
		'假人化',
		'失去你棋盘上和备战席的所有弈子。获得1个【训练假人】，其生命值为所有失去弈子总生命值的60%。假人每阶段获得1150生命值。获得1个随机2星2费非坦克弈子。',
		1,
		[{ kind: 'dummify', hpPct: 0.6 }],
	),
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
	A(
		'TFT_Augment_InvestmentStrategy2',
		'投资策略 II',
		'你的最大利息提升至7金币。你的弈子们每有1点已获利息，便获得15最大生命值。获得3金币。',
		2,
		[
			{ kind: 'interestCap', add: 2 },
			{ kind: 'teamHpPerInterest', amount: 15 },
			{ kind: 'goldNow', amount: 3 },
		],
	),
	A('TFT_Augment_ShojinSpirit', '长矛意志', '你的队伍获得8%物理加成。获得2件随机基础装备。', 2, [
		{ kind: 'teamBuff', adPct: 0.08 },
		{ kind: 'components', count: 2 },
	]),
	A('TFT_Augment_MoneyHungry', '贪财', '立刻获得7金币，然后在每个阶段开始时获得7金币。', 2, [
		{ kind: 'goldNow', amount: 7 },
		{ kind: 'stageGold', amount: 7 },
	]),
	A('TFT_Augment_GainGold', '获得金币', '获得21金币。', 2, [{ kind: 'goldNow', amount: 21 }]),
	A('DA_18_BigGrabBag', '大百宝袋', '获得3件随机基础装备、2金币和1个【装备重铸器】。', 2, [
		{ kind: 'components', count: 3 },
		{ kind: 'goldNow', amount: 2 },
		{ kind: 'consumablesNow', rerollers: 1 },
	]),
	A('DA_18_DuoQueue', '双排', '获得2个随机5费弈子和2件相同的随机基础装备。', 2, [
		{ kind: 'randomChamps', cost: 5, count: 2 },
		{ kind: 'componentsSame', count: 2 },
	]),
	A('DA_18_OneTwoFive', '一，二，五！', '获得1件随机基础装备、2金币和1个随机5费弈子。', 2, [
		{ kind: 'components', count: 1 },
		{ kind: 'goldNow', amount: 2 },
		{ kind: 'randomChamps', cost: 5, count: 1 },
	]),
	A('TFT_Augment_TwoTrick', '两把刷子', '获得1个随机的2星2费弈子和2个随机的2星1费弈子。', 2, [
		{ kind: 'randomChamps', cost: 2, count: 1, star: 2 },
		{ kind: 'randomChamps', cost: 1, count: 2, star: 2 },
	]),
	A(
		'TFT_Augment_CognitiveOverload',
		'认知过载',
		'获得7金币、1个2星1费弈子、1个2费弈子、2个3费弈子、1经验值和1次商店刷新次数。',
		2,
		[
			{ kind: 'goldNow', amount: 7 },
			{ kind: 'randomChamps', cost: 1, count: 1, star: 2 },
			{ kind: 'randomChamps', cost: 2, count: 1 },
			{ kind: 'randomChamps', cost: 3, count: 2 },
			{ kind: 'xpNow', amount: 1 },
			{ kind: 'rerollsNow', count: 1 },
		],
	),
	A('TFT_Augment_GoldDestiny', '黄金命运', '获得1个随机黄金阶强化符文和3金币。', 2, [
		{ kind: 'randomAugment', tier: 2 },
		{ kind: 'goldNow', amount: 3 },
	]),
	A(
		'TFT_Augment_BodyguardTraining',
		'利落保镖',
		'己方弈子们获得15护甲和魔法抗性，每次玩家升级会提升该加成2。',
		2,
		[{ kind: 'resistsPerLevel', base: 15, perLevel: 2 }],
	),
	A(
		'DA_18_RiftbeastTraitAugment',
		'欧米茄之怪',
		'你现在可以选择第二个被【阿尔法印记】标记的【峡谷野怪】。获得1个【峡谷迅捷蟹】、1个【绯红树怪】和1个【苍蓝哨戒】。',
		2,
		[
			{ kind: 'alphaMarkExtra', count: 1 },
			{
				kind: 'namedChamps',
				champs: [
					{ name: '峡谷迅捷蟹', count: 1 },
					{ name: '绯红树怪', count: 1 },
					{ name: '苍蓝哨戒', count: 1 },
				],
			},
		],
	),
	A(
		'DA_18_WispRebatePlus',
		'仙灵报恩',
		'你每次购买【自然仙灵】，都会获得2金币。立刻获得4金币。',
		2,
		[
			{ kind: 'goldNow', amount: 4 },
			{ kind: 'onBuyBlossom', gold: 2 },
		],
	),
	A(
		'DA_18_ResidualMagicPlus',
		'残留魔力+',
		'你的队伍获得75生命值。你每次购买【自然仙灵】，都会将该加成提升10。',
		2,
		[
			{ kind: 'teamBuff', hpFlat: 75 },
			{ kind: 'onBuyBlossom', hpFlat: 10 },
		],
	),
	A('DA_PortableForge', '便携锻炉', '在4件神器中选择1件。神器是可以提供独特效果的强力装备。', 2, [
		{ kind: 'armoryNow', pool: 'artifact' },
	]),
	A(
		'DA_SweetTreats',
		'甜点',
		'获得1个【神器锻造器】。你的弈子们每携带1件装备，你的队伍就会获得16生命值。',
		2,
		[
			{ kind: 'armoryNow', pool: 'artifact' },
			{ kind: 'teamHpPerItem', amount: 16 },
		],
	),
	A('DA_CaretakersFavor', '游神的眷顾', '在你到达5、6、7和8级时，获得1个【基础装备锻造器】。', 2, [
		{ kind: 'armoryAtLevels', pool: 'component', levels: [5, 6, 7, 8] },
	]),
	A(
		'DA_NestingAnvilsPlus',
		'锻造器套娃+',
		'获得1个【神器锻造器】。在你开启它之后，获得1个【基础装备锻造器】。开启这个【基础装备锻造器】后，又获得8金币。',
		2,
		[{ kind: 'armoryNow', pool: 'artifact', chain: { pool: 'component', gold: 8 } }],
	),
	A('DA_18_BranchingOutPlus', '节外生枝+', '获得1个随机纹章和1个【装备重铸器】。', 2, [
		{ kind: 'randomEmblems', count: 1 },
		{ kind: 'consumablesNow', rerollers: 1 },
	]),
	A('DA_SpreadingRoots', '蔓延之根', '获得一个随机纹章。在3场玩家对战回合后，获得另一个。', 2, [
		{ kind: 'randomEmblems', count: 1 },
		{ kind: 'delayRandom', rounds: 3, emblems: 1 },
	]),
	A('DA_SpreadingRootsPlus', '蔓延之根+', '获得2个随机纹章和2金币。', 2, [
		{ kind: 'randomEmblems', count: 2 },
		{ kind: 'goldNow', amount: 2 },
	]),
	A(
		'DA_Flexible',
		'灵活摇摆',
		'获得1个随机纹章。在每阶段开始时，获得1个随机纹章。你的队伍每携带1个纹章，就会获得30生命值。',
		2,
		[
			{ kind: 'randomEmblems', count: 1 },
			{ kind: 'stageEmblem' },
			{ kind: 'teamHpPerEmblem', amount: 30 },
		],
	),
	A(
		'DA_URF',
		'厨神阿福',
		'获得1个【金铲铲】。携带了【金铲铲】或【金锅锅】系装备的弈子们获得20%攻击速度和3法力回复。',
		2,
		[
			{ kind: 'namedItems', apiNames: ['TFT_Item_Spatula'] },
			{ kind: 'holderBuff', match: 'spatPan', asPct: 0.2, manaRegen: 3 },
		],
	),
	A(
		'DA_CookingPot',
		'金色炊具',
		'在每回合开始时，所有持有【金锅锅】或【金铲铲】装备的友军都会为最近的弈子提供60永久生命值。获得1个【金锅锅】。',
		2,
		[
			{ kind: 'namedItems', apiNames: ['TFT_Item_FryingPan'] },
			{ kind: 'roundStartSpatHp', amount: 60 },
		],
	),
	A(
		'DA_SalvageBinPlus',
		'打捞桶+',
		'立刻获得1件随机成装，并在4场玩家对战回合后获得1件基础装备。出售弈子会将其携带的成装拆分成基础装备(冠冕系装备和纹章除外)。',
		2,
		[
			{ kind: 'randomCompleted', count: 1 },
			{ kind: 'delayRandom', rounds: 4, components: 1 },
			{ kind: 'salvageSplit' },
		],
	),
	A(
		'TFT_Augment_GoldForDummies',
		'假人金币',
		'获得1个【训练假人】。战斗环节中：每10秒，所有【训练假人】提供1金币。',
		2,
		[
			{ kind: 'dummyNow', count: 1 },
			{ kind: 'dummyGold', perSeconds: 10, amount: 1 },
		],
	),
	A(
		'TFT10_Augment_CrashTestDummies',
		'碰撞测试假人',
		'获得2个【训练假人】。战斗开始时：你的【目标假人】们会将自己发射向敌人最密集的位置并将其晕眩1秒。',
		2,
		[
			{ kind: 'dummyNow', count: 2 },
			{ kind: 'crashTest', stun: 1 },
		],
	),
	A(
		'TFT10_Augment_Scapegoat',
		'替罪羊',
		'获得1个【训练假人】和4金币。如果这个假人在玩家对战回合中第一个阵亡，就会获得1金币。',
		2,
		[
			{ kind: 'dummyNow', count: 1 },
			{ kind: 'goldNow', amount: 4 },
			{ kind: 'scapegoatGold', amount: 1 },
		],
	),
	A('DA_BacklineBlueprint', '后排蓝图', '获得1个3费弈子，以及一个与其职业相匹配的纹章。', 2, [
		{ kind: 'champWithEmblem', cost: 3 },
	]),
	A('DA_FrontlineFoundation', '前线地基', '获得1个2星1费弈子，以及一个与其职业相匹配的纹章。', 2, [
		{ kind: 'champWithEmblem', cost: 1, star: 2 },
	]),
	A(
		'DA_18_FloraFatalisAugment',
		'致命丽花',
		'获得1个【绝命花妖纹章】。携带该纹章的弈子从【绝命花妖】羁绊中获得50%额外加成。获得3金币。',
		2,
		[
			{ kind: 'namedItems', apiNames: ['DA_18_EmblemFloraFatalis'] },
			{ kind: 'emblemTraitAmp', trait: 'DA_FloraFatalis18', pct: 0.5 },
			{ kind: 'goldNow', amount: 3 },
		],
	),
	// ---- 棱彩 ----
	A('TFT_Augment_MinMaxer', '可大可小', '获得4个随机基础装备。', 3, [
		{ kind: 'components', count: 4 },
	]),
	A('TFT_Augment_MoneyMonsoon', '摇钱树', '立刻并在剩余游戏时间内每回合获得7金币。', 3, [
		{ kind: 'goldNow', amount: 7 },
		{ kind: 'roundGold', amount: 7 },
	]),
	A(
		'TFT_Augment_GiantAndMighty',
		'大而有力',
		'你的队伍体型变大，获得200生命值和10%最大生命值。',
		3,
		[{ kind: 'teamBuff', hpFlat: 200, hpPct: 0.1 }],
	),
	A('TFT_Augment_PrismaticDestiny', '棱彩命运', '获得1个随机的棱彩阶强化符文和3金币。', 3, [
		{ kind: 'randomAugment', tier: 3 },
		{ kind: 'goldNow', amount: 3 },
	]),
	A(
		'DA_18_WispRebatePlusPlus',
		'仙灵报恩+',
		'你每次购买【自然仙灵】，都会获得2金币。立刻获得8金币。',
		3,
		[
			{ kind: 'goldNow', amount: 8 },
			{ kind: 'onBuyBlossom', gold: 2 },
		],
	),
	A(
		'DA_18_ResidualMagicPlusPlus',
		'残留魔力++',
		'你的队伍获得90生命值。你每次购买【自然仙灵】，都会将该加成提升10。',
		3,
		[
			{ kind: 'teamBuff', hpFlat: 90 },
			{ kind: 'onBuyBlossom', hpFlat: 10 },
		],
	),
	A('DA_LivingForge', '活体锻炉', '立刻以及每10场玩家对战回合后，获得1个【神器锻造器】。', 3, [
		{ kind: 'armoryNow', pool: 'artifact' },
		{ kind: 'armoryPerRounds', pool: 'artifact', rounds: 10 },
	]),
	A('DA_TheTraitTree', '羁绊树', '获得3个随机纹章和2金币。', 3, [
		{ kind: 'randomEmblems', count: 3 },
		{ kind: 'goldNow', amount: 2 },
	]),
	A('DA_TheTraitTreePlus', '羁绊树+', '获得3个随机纹章、1个【装备重铸器】和4金币。', 3, [
		{ kind: 'randomEmblems', count: 3 },
		{ kind: 'consumablesNow', rerollers: 1 },
		{ kind: 'goldNow', amount: 4 },
	]),
	A(
		'DA_HardCommit',
		'硬性承诺',
		'获得1个随机纹章。立刻以及每阶段开始时，获得该羁绊的1个1星弈子，且该弈子的费用相当于当前阶段数(最多为5)，并获得3金币。',
		3,
		[
			{ kind: 'randomEmblems', count: 1 },
			{ kind: 'stageEmblemChamp', gold: 3 },
		],
	),
	A(
		'DA_Coronation',
		'加冕礼',
		'获得1个【金铲铲冠冕】。【金铲铲冠冕】、【金锅锅冠冕】和【金锅铲冠冕】为携带者提供20%攻击速度、25%物理加成和30%法术加成。',
		3,
		[
			{ kind: 'namedItems', apiNames: ['DA_TacticiansCrown'] },
			{ kind: 'holderBuff', match: 'crown', asPct: 0.2, adPct: 0.25, apPct: 0.3 },
		],
	),
	A('DA_UrfsGrabBag', '阿福的百宝袋', '获得1个【金铲铲】、3件随机基础装备和5金币。', 3, [
		{ kind: 'namedItems', apiNames: ['TFT_Item_Spatula'] },
		{ kind: 'components', count: 3 },
		{ kind: 'goldNow', amount: 5 },
	]),
	A(
		'DA_ForgedInStrength',
		'神力天铸',
		'获得2件随机神器。当你降至35生命值时，额外获得1件随机神器、1件随机成装、以及1件随机基础装备。',
		3,
		[
			{ kind: 'randomArtifacts', count: 2 },
			{ kind: 'hpThresholdItems', hp: 35, artifacts: 1, completed: 1, components: 1 },
		],
	),
	A(
		'DA_TheTower',
		'高塔',
		'获得1个巨大的【训练假人】。每3秒，电击距离最近的4个敌人，造成5%最大生命值的真实伤害。',
		3,
		[{ kind: 'dummyNow', count: 1, big: true }],
	),
	A(
		'DA_WeStickTogether',
		'水乳交融',
		'获得1个随机纹章和1个【成装锻造器】。与该纹章有同一羁绊的友军获得30%攻击速度。',
		3,
		[
			{ kind: 'randomEmblems', count: 1 },
			{ kind: 'armoryNow', pool: 'completed' },
			{ kind: 'emblemSynergyBuff', asPct: 0.3 },
		],
	),
	A('DA_RadiantRelic', '光明圣物', '从5件光明武器中选择1件。获得1个【装备拆卸器】。', 3, [
		{ kind: 'armoryNow', pool: 'radiant', options: 5 },
		{ kind: 'consumablesNow', removers: 1 },
	]),
	A(
		'DA_PandorasItemsIII',
		'潘朵拉的装备 III',
		'回合开始时：你备战席的装备会随机变化。获得1件光明武器。',
		3,
		[{ kind: 'pandoraTray' }, { kind: 'randomRadiant', count: 1 }],
	),
	A('DA_RadiantRascal', '光明无赖', '获得1个【光明版窃贼手套】。每回合装备2件随机光明武器。', 3, [
		{ kind: 'namedItems', apiNames: ['DA_ThiefsGlovesRadiant'] },
	]),
	A(
		'DA_GoldenGamble',
		'黄金赌约',
		'获得2金币，并抛掷1枚硬币。如果硬币正面朝上，获得1个【光明版幸运装备宝箱】。如果硬币反面朝上，获得2个【成装锻造器】。',
		3,
		[{ kind: 'coinFlipArmory', gold: 2, tailsPool: 'completed', tailsCount: 2 }],
	),
	A(
		'DA_GoldenGamblePlus',
		'黄金赌约+',
		'获得3金币，并抛掷1枚硬币。如果硬币正面朝上，获得1个【光明版幸运装备宝箱】。如果硬币反面朝上，获得2个【成装锻造器】。',
		3,
		[{ kind: 'coinFlipArmory', gold: 3, tailsPool: 'completed', tailsCount: 2 }],
	),
	A(
		'DA_GoldenGamblePlusPlus',
		'黄金赌约++',
		'获得6金币，并抛掷1枚硬币。如果硬币正面朝上，获得1个【光明版幸运装备宝箱】。如果硬币反面朝上，获得2个【成装锻造器】。',
		3,
		[{ kind: 'coinFlipArmory', gold: 6, tailsPool: 'completed', tailsCount: 2 }],
	),
	A(
		'DA_18_LuxAugmentII',
		'创世神',
		'开启1个武器库，并在3个羁绊选项中选择1个。获得1个该羁绊的【拉克丝】和1个【朔极之矛】。你棋盘上的羁绊会更有可能出现在该武器库中。【拉克丝】为她选定的羁绊提供+2计数。',
		3,
		[{ kind: 'luxCreator' }],
	),
	// ---- cat2 批量补录：白银 ----
	A('DA_BandOfThieves', '窃贼帮派', '获得1个【窃贼手套】。', 1, [
		{ kind: 'namedItems', apiNames: ['DA_ThiefsGloves'] },
	]),
	A('DA_BoxingLessons', '拳击课程', '战斗开始时，前排每有1个弈子，你的队伍获得30生命值。', 1, [
		{ kind: 'hpPerFrontRow', amount: 30 },
	]),
	A('DA_CalledShot', '进攻宣告', '将你的连胜数设为+4。获得4金币。', 1, [
		{ kind: 'streakWin', count: 4 },
		{ kind: 'goldNow', amount: 4 },
	]),
	A('DA_CognitiveTax', '认知税', '获得8金币和1经验值。', 1, [
		{ kind: 'goldNow', amount: 8 },
		{ kind: 'xpNow', amount: 1 },
	]),
	A('DA_CognitiveTaxPlus', '认知税+', '获得3金币和12经验值。', 1, [
		{ kind: 'goldNow', amount: 3 },
		{ kind: 'xpNow', amount: 12 },
	]),
	A(
		'DA_FeelingLucky',
		'手气不错',
		'获得4金币，然后抛掷1枚硬币。如果硬币正面朝上，额外获得12金币。',
		1,
		[
			{ kind: 'goldNow', amount: 4 },
			{ kind: 'goldCoinFlip', amount: 12 },
		],
	),
	A('DA_FocusedFire', '集中火力', '你的队伍获得10%物理加成。每5秒，额外获得5%。', 1, [
		{ kind: 'teamBuff', adPct: 0.1 },
	]),
	A('DA_ItemGrabBag', '装备百宝袋 I', '获得1件随机成装。', 1, [
		{ kind: 'randomCompleted', count: 1 },
	]),
	A('DA_KickStart', '博弈开启', '获得1个随机2星2费弈子和1金币。', 1, [
		{ kind: 'randomChamps', cost: 2, count: 1, star: 2 },
		{ kind: 'goldNow', amount: 1 },
	]),
	A(
		'DA_Kingslayer',
		'弑君突刺',
		'在赢得玩家对战回合后，获得1金币。如果这位玩家之前的生命值多于你的生命值，转而获得6金币。获得1金币。',
		1,
		[
			{ kind: 'winGold', amount: 1 },
			{ kind: 'goldNow', amount: 1 },
		],
	),
	A('DA_MissedConnections', '别再错过', '获得每个1费弈子各1个。', 1, [
		{
			kind: 'namedChamps',
			champs: [
				{ name: '霞', count: 1 },
				{ name: '奥恩', count: 1 },
				{ name: '雷克塞', count: 1 },
				{ name: '维迦', count: 1 },
				{ name: '约里克', count: 1 },
				{ name: '洛', count: 1 },
				{ name: '可酷伯', count: 1 },
				{ name: '阿卡丽', count: 1 },
				{ name: '韦鲁斯', count: 1 },
				{ name: '蕾欧娜', count: 1 },
				{ name: '卡尔玛', count: 1 },
				{ name: '卡蜜尔', count: 1 },
			],
		},
	]),
	A(
		'DA_PandorasItemsI',
		'潘朵拉的装备 I',
		'回合开始时：你备战席的装备会随机变化。获得1件随机基础装备。',
		1,
		[{ kind: 'pandoraTray' }, { kind: 'components', count: 1 }],
	),
	A(
		'DA_PatienceIsAVirtue',
		'耐心是一种美德',
		'立刻获得4次刷新。每回合，如果你在上回合未购买任何弈子，则会获得1次免费刷新。',
		1,
		[
			{ kind: 'rerollsNow', count: 4 },
			{ kind: 'freeRerolls', perRound: 1 },
		],
	),
	A('DA_RollingForDays', 'D个痛快！', '获得10次免费商店刷新。', 1, [
		{ kind: 'rerollsNow', count: 10 },
	]),
	A('DA_SilverDestiny', '白银命运', '获得1个随机白银阶强化符文和2金币。', 1, [
		{ kind: 'randomAugment', tier: 1 },
		{ kind: 'goldNow', amount: 2 },
	]),
	A('DA_SilverDestinyPlus', '白银命运+', '获得1个随机白银阶强化符文和4金币。', 1, [
		{ kind: 'randomAugment', tier: 1 },
		{ kind: 'goldNow', amount: 4 },
	]),
	A('DA_SilverDestinyPlusPlus', '白银命运++', '获得1个随机白银阶强化符文和7金币。', 1, [
		{ kind: 'randomAugment', tier: 1 },
		{ kind: 'goldNow', amount: 7 },
	]),
	A('DA_SilverSpoon', '银汤匙', '获得10经验值。', 1, [{ kind: 'xpNow', amount: 10 }]),
	A('DA_SmallGrabBag', '小小福袋', '获得2件随机基础装备。', 1, [{ kind: 'components', count: 2 }]),
	A('TFT6_Augment_ItemGrabBag1', '装备百宝袋', '提供1件随机成装。', 1, [
		{ kind: 'randomCompleted', count: 1 },
	]),
	A(
		'TFT6_Augment_OneTwoFive',
		'一，二，五！',
		'获得1个随机的基础装备、2金币、和1个随机的5费弈子。',
		1,
		[
			{ kind: 'components', count: 1 },
			{ kind: 'goldNow', amount: 2 },
			{ kind: 'randomChamps', cost: 5, count: 1 },
		],
	),
	A(
		'TFT6_Augment_PandorasItems',
		'潘朵拉的装备',
		'回合开始时：你备战席上的装备会随机变化。获得1件随机基础装备。',
		1,
		[{ kind: 'pandoraTray' }, { kind: 'components', count: 1 }],
	),
	A('TFT7_Augment_BandOfThieves1', '窃贼帮派', '提供1个【窃贼手套】。', 1, [
		{ kind: 'namedItems', apiNames: ['DA_ThiefsGloves'] },
	]),
	A('TFT9_Augment_Commander_RollingForDays', 'D个痛快！ I', '获得10次免费刷新。', 1, [
		{ kind: 'rerollsNow', count: 10 },
	]),
	A(
		'TFT9_Augment_Commander_TeamingUp1',
		'集结战队',
		'获得1个随机的基础装备和2个随机的3费弈子。',
		1,
		[
			{ kind: 'components', count: 1 },
			{ kind: 'randomChamps', cost: 3, count: 2 },
		],
	),
	A('TFT9_Augment_IronAssets', '黑铁资产', '获得1个【基础装备锻造器】和3金币。', 1, [
		{ kind: 'armoryNow', pool: 'component' },
		{ kind: 'goldNow', amount: 3 },
	]),
	A('TFT9_Augment_LongTimeCrafting', '休眠锻炉', '在8个玩家对战后，获得1个【神器锻造器】。', 1, [
		{ kind: 'armoryAfterRounds', pool: 'artifact', rounds: 8 },
	]),
	A('TFT9_Augment_MissedConnections', '别再错过', '获得每个1费弈子各1个。', 1, [
		{
			kind: 'namedChamps',
			champs: [
				{ name: '霞', count: 1 },
				{ name: '奥恩', count: 1 },
				{ name: '雷克塞', count: 1 },
				{ name: '维迦', count: 1 },
				{ name: '约里克', count: 1 },
				{ name: '洛', count: 1 },
				{ name: '可酷伯', count: 1 },
				{ name: '阿卡丽', count: 1 },
				{ name: '韦鲁斯', count: 1 },
				{ name: '蕾欧娜', count: 1 },
				{ name: '卡尔玛', count: 1 },
				{ name: '卡蜜尔', count: 1 },
			],
		},
	]),
	A('TFT9_Augment_OneTwosThree', '一，二，三', '获得2个1费弈子、1个2费弈子和1个3费弈子。', 1, [
		{ kind: 'randomChamps', cost: 1, count: 2 },
		{ kind: 'randomChamps', cost: 2, count: 1 },
		{ kind: 'randomChamps', cost: 3, count: 1 },
	]),
	A('TFT9_Augment_SilverSpoon', '银汤匙', '获得10经验值。', 1, [{ kind: 'xpNow', amount: 10 }]),
	A('TFT_Augment_BranchingOut', '节外生枝', '获得1个随机纹章。', 1, [
		{ kind: 'randomEmblems', count: 1 },
	]),
	A('TFT_Augment_BranchingOutPlus', '节外生枝+', '提供1个随机【纹章】和1个【装备重铸器】。', 1, [
		{ kind: 'randomEmblems', count: 1 },
		{ kind: 'consumablesNow', rerollers: 1 },
	]),
	A(
		'TFT_Augment_Dummify',
		'假人化',
		'失去你场上和备战席上的所有弈子。获得1个【训练假人】，其生命值为失去所有弈子总生命值的60%。这个【训练假人】每阶段获得1000生命值。获得1个非坦克的2星2费弈子。',
		1,
		[
			{ kind: 'dummify', hpPct: 0.6 },
			{ kind: 'randomChamps', cost: 2, count: 1, star: 2 },
		],
	),
	A('TFT_Augment_SilverDestinyPlus', '白银命运+', '获得1个随机白银阶强化符文和4金币。', 1, [
		{ kind: 'randomAugment', tier: 1 },
		{ kind: 'goldNow', amount: 4 },
	]),
	A('TFT_Augment_SilverDestinyPlusPlus', '白银命运++', '获得1个随机白银阶强化符文和7金币。', 1, [
		{ kind: 'randomAugment', tier: 1 },
		{ kind: 'goldNow', amount: 7 },
	]),
	A(
		'TFT_Augment_TheTower',
		'高塔',
		'获得1个拥有额外生命值(随阶段提升)的巨大训练假人。每4秒，电击距离最近的3个敌人，造成5%最大生命值的真实伤害。',
		1,
		[{ kind: 'dummyNow', count: 1, big: true }],
	),

	// ---- cat2 批量补录：黄金 ----
	A('DA_BodyguardTraining', '利落保镖', '友军获得15护甲和魔法抗性，每玩家等级提升该加成2。', 2, [
		{ kind: 'resistsPerLevel', base: 15, perLevel: 2 },
	]),
	A(
		'DA_CognitiveOverload',
		'认知过载',
		'获得7金币、1个2星1费弈子、1个2费弈子、2个3费弈子、1经验值以及1次商店刷新。',
		2,
		[
			{ kind: 'goldNow', amount: 7 },
			{ kind: 'randomChamps', cost: 1, count: 1, star: 2 },
			{ kind: 'randomChamps', cost: 2, count: 1 },
			{ kind: 'randomChamps', cost: 3, count: 2 },
			{ kind: 'xpNow', amount: 1 },
			{ kind: 'rerollsNow', count: 1 },
		],
	),
	A('DA_GainGold', '获得21金币', '获得21金币。', 2, [{ kind: 'goldNow', amount: 21 }]),
	A('DA_GoldDestiny', '黄金命运', '获得1个随机黄金阶强化符文和3金币。', 2, [
		{ kind: 'randomAugment', tier: 2 },
		{ kind: 'goldNow', amount: 3 },
	]),
	A('DA_GoldDestinyPlus', '黄金命运+', '获得1个随机黄金阶强化符文和5金币。', 2, [
		{ kind: 'randomAugment', tier: 2 },
		{ kind: 'goldNow', amount: 5 },
	]),
	A(
		'DA_InvestmentStrategyI',
		'投资策略 I',
		'你每获得1利息，你的弈子们获得8永久最大生命值。立刻获得4金币。',
		2,
		[
			{ kind: 'teamHpPerInterest', amount: 8 },
			{ kind: 'goldNow', amount: 4 },
		],
	),
	A(
		'DA_MoneyHungryPlus',
		'贪财+',
		'立刻获得7金币，然后在每阶段开始时获得13金币。拾取金币会令你的小小英雄变大。',
		2,
		[
			{ kind: 'goldNow', amount: 7 },
			{ kind: 'stageGold', amount: 13 },
		],
	),
	A(
		'DA_MoneyHungry_NotBroken',
		'贪财',
		'立刻获得7金币，然后在每阶段开始时获得7金币。拾取金币会令你的小小英雄变大。',
		2,
		[
			{ kind: 'goldNow', amount: 7 },
			{ kind: 'stageGold', amount: 7 },
		],
	),
	A(
		'DA_PandorasItemsII',
		'潘朵拉的装备 II',
		'回合开始时：你备战席的装备会随机变化。获得2件随机基础装备。',
		2,
		[{ kind: 'pandoraTray' }, { kind: 'components', count: 2 }],
	),
	A(
		'DA_TonsOfStatsI',
		'成吨的属性',
		'你的队伍获得44生命值、4%物理加成、4%法术加成、4护甲、4魔法抗性、4%攻击速度和4法力值。',
		2,
		[
			{
				kind: 'teamBuff',
				hpFlat: 44,
				adPct: 0.04,
				apPct: 0.04,
				armor: 4,
				mr: 4,
				asPct: 0.04,
				mana: 4,
			},
		],
	),
	A(
		'DA_TonsOfStatsII',
		'成吨的属性！',
		'你的队伍获得88生命值、8%物理加成、8%法术加成、8护甲、8魔法抗性、8%攻击速度和8法力值。',
		2,
		[
			{
				kind: 'teamBuff',
				hpFlat: 88,
				adPct: 0.08,
				apPct: 0.08,
				armor: 8,
				mr: 8,
				asPct: 0.08,
				mana: 8,
			},
		],
	),
	A('DA_TradeSector', 'DD街区', '每回合获得1次商店刷新。获得2金币。', 2, [
		{ kind: 'freeRerolls', perRound: 1 },
		{ kind: 'goldNow', amount: 2 },
	]),
	A('DA_TradeSectorPlus', 'DD街区+', '每回合获得1次商店刷新。获得8金币。', 2, [
		{ kind: 'freeRerolls', perRound: 1 },
		{ kind: 'goldNow', amount: 8 },
	]),
	A('TFT11_Augment_RainingGold', '天降金币', '即刻获得7金币，并且每回合获得1金币。', 2, [
		{ kind: 'goldNow', amount: 7 },
		{ kind: 'roundGold', amount: 1 },
	]),
	A('TFT11_Augment_RainingGoldPlus', '天降金币+', '即刻获得18金币，并且每回合获得1金币。', 2, [
		{ kind: 'goldNow', amount: 18 },
		{ kind: 'roundGold', amount: 1 },
	]),
	A(
		'TFT16_Augment_UltraRapidFire',
		'厨神阿福',
		'获得1个【金铲铲】。携带了【金铲铲】或【金锅锅】的弈子们获得20%攻击速度和3法力回复。',
		2,
		[
			{ kind: 'namedItems', apiNames: ['TFT_Item_Spatula'] },
			{ kind: 'holderBuff', match: 'spatPan', asPct: 0.2, manaRegen: 3 },
		],
	),
	A('TFT6_Augment_PortableForge', '便携锻炉', '从4件神器中选出1件。', 2, [
		{ kind: 'armoryNow', pool: 'artifact', options: 4 },
	]),
	A(
		'TFT6_Augment_SalvageBin',
		'打捞桶',
		'立刻获得1件随机成装，并在8个玩家对战回合之后提供1个基础装备。出售弈子会将其携带的成装拆分成基础装备(冠冕系装备和纹章除外)。',
		2,
		[
			{ kind: 'randomCompleted', count: 1 },
			{ kind: 'delayRandom', rounds: 8, components: 1 },
			{ kind: 'salvageSplit' },
		],
	),
	A(
		'TFT6_Augment_SalvageBinHR',
		'打捞桶',
		'立刻获得1件随机成装，并在3个玩家对战回合之后提供1个基础装备。出售弈子会将其携带的成装拆分成基础装备(冠冕系装备和纹章除外)。',
		2,
		[
			{ kind: 'randomCompleted', count: 1 },
			{ kind: 'delayRandom', rounds: 3, components: 1 },
			{ kind: 'salvageSplit' },
		],
	),
	A('TFT6_Augment_TradeSector', 'DD街区', '每回合获得1次免费的商店刷新。获得2金币。', 2, [
		{ kind: 'freeRerolls', perRound: 1 },
		{ kind: 'goldNow', amount: 2 },
	]),
	A(
		'TFT8_Augment_SalvageBinPlus',
		'打捞桶+',
		'立刻获得1件随机成装，并在4个玩家对战回合之后提供1个基础装备。出售弈子会将其携带的成装拆分成基础装备(冠冕系装备和纹章除外)。',
		2,
		[
			{ kind: 'randomCompleted', count: 1 },
			{ kind: 'delayRandom', rounds: 4, components: 1 },
			{ kind: 'salvageSplit' },
		],
	),
	A(
		'TFT9_Augment_BardPlaybook2',
		'游神的眷顾',
		'在你达到5级、6级、7级和8级时获得1个【基础装备锻造器】。',
		2,
		[{ kind: 'armoryAtLevels', pool: 'component', levels: [5, 6, 7, 8] }],
	),
	A('TFT9_Augment_BigGrabBag', '大百宝袋', '获得3件随机基础装备、2金币和1个【装备重铸器】。', 2, [
		{ kind: 'components', count: 3 },
		{ kind: 'goldNow', amount: 2 },
		{ kind: 'consumablesNow', rerollers: 1 },
	]),
	A(
		'TFT9_Augment_PandorasItems2',
		'潘朵拉的装备 II',
		'回合开始时：你备战席上的装备会随机变化。获得2件随机基础装备。',
		2,
		[{ kind: 'pandoraTray' }, { kind: 'components', count: 2 }],
	),
	A(
		'TFT9_Augment_TonsOfStats',
		'成吨的属性！',
		'你的弈子们获得44生命值、4%物理加成、4%法术加成、4护甲、4魔抗、4%攻击速度和4法力值。',
		2,
		[
			{
				kind: 'teamBuff',
				hpFlat: 44,
				adPct: 0.04,
				apPct: 0.04,
				armor: 4,
				mr: 4,
				asPct: 0.04,
				mana: 4,
			},
		],
	),
	A(
		'TFT9_Augment_YouHaveMyBow',
		'吾弓听命于您',
		'获得1个【反曲之弓】。你的队伍获得12%攻击速度。',
		2,
		[
			{ kind: 'namedItems', apiNames: ['TFT_Item_RecurveBow'] },
			{ kind: 'teamBuff', asPct: 0.12 },
		],
	),
	A(
		'TFT_Augment_BacklineBlueprint',
		'后排蓝图',
		'获得1个3费非坦克弈子，以及一个与其最后列出羁绊相匹配的纹章。',
		2,
		[{ kind: 'champWithEmblem', cost: 3 }],
	),
	A(
		'TFT_Augment_CookingPot',
		'金色炊具',
		'在每回合开始时，所有持有【金锅锅】或【金铲铲】装备的己方弈子都会给最近的弈子提供60永久生命值。获得1个【金锅锅】。',
		2,
		[
			{ kind: 'namedItems', apiNames: ['TFT_Item_FryingPan'] },
			{ kind: 'roundStartSpatHp', amount: 60 },
		],
	),
	A(
		'TFT_Augment_CrownguardSpirit',
		'王冠意志',
		'获得1个【无用大棒】和1个【锁子甲】。你的队伍获得8法术加成和6护甲。',
		2,
		[
			{ kind: 'namedItems', apiNames: ['TFT_Item_NeedlesslyLargeRod', 'TFT_Item_ChainVest'] },
			{ kind: 'teamBuff', ap: 8, armor: 6 },
		],
	),
	A('TFT_Augment_DuoQueue', '双排', '获得2个随机的5费弈子和2件相同的随机基础装备。', 2, [
		{ kind: 'randomChamps', cost: 5, count: 2 },
		{ kind: 'componentsSame', count: 2 },
	]),
	A(
		'TFT_Augment_Flexible',
		'灵活摇摆',
		'获得1个随机纹章。在每个阶段开始时，获得1个随机纹章。你的队伍每携带一个纹章，就会获得30生命值。',
		2,
		[
			{ kind: 'randomEmblems', count: 1 },
			{ kind: 'stageEmblem' },
			{ kind: 'teamHpPerEmblem', amount: 30 },
		],
	),
	A(
		'TFT_Augment_FrontlineFoundation',
		'前线地基',
		'获得1个2星1费坦克弈子，以及一个与其最后列出羁绊相匹配的纹章。',
		2,
		[{ kind: 'champWithEmblem', cost: 1, star: 2 }],
	),
	A('TFT_Augment_GoldDestinyPlus', '黄金命运+', '获得1个随机黄金阶强化符文和6金币。', 2, [
		{ kind: 'randomAugment', tier: 2 },
		{ kind: 'goldNow', amount: 6 },
	]),
	A(
		'TFT_Augment_InvestmentStrategy1',
		'投资策略 I',
		'你每获得1利息，你的弈子们就获得8永久最大生命值。',
		2,
		[{ kind: 'teamHpPerInterest', amount: 8 }],
	),
	A('TFT_Augment_SpreadingRoots', '蔓延之根', '获得2个随机纹章和1金币。', 2, [
		{ kind: 'randomEmblems', count: 2 },
		{ kind: 'goldNow', amount: 1 },
	]),
	A(
		'TFT_Augment_SpreadingRootsPlus',
		'蔓延之根+',
		'获得2个随机纹章、一个【装备重铸器】和2金币。',
		2,
		[
			{ kind: 'randomEmblems', count: 2 },
			{ kind: 'consumablesNow', rerollers: 1 },
			{ kind: 'goldNow', amount: 2 },
		],
	),

	// ---- cat2 批量补录：棱彩 ----
	A('DA_BuildABud', '来个好伙计！', '获得1个随机3星1费弈子。获得6金币。', 3, [
		{ kind: 'randomChamps', cost: 1, count: 1, star: 3 },
		{ kind: 'goldNow', amount: 6 },
	]),
	A(
		'DA_BuriedTreasuresIII',
		'珍藏财宝 III',
		'立刻以及接下来的6个回合开始时，获得1件随机基础装备。',
		3,
		[
			{ kind: 'components', count: 1 },
			{ kind: 'delayRandom', rounds: 1, repeat: true, times: 6, components: 1 },
		],
	),
	A(
		'DA_CommerceCore',
		'贸易中心',
		'立刻获得16次免费商店刷新，并在剩余游戏时间内每回合获得3次免费商店刷新。',
		3,
		[
			{ kind: 'rerollsNow', count: 16 },
			{ kind: 'freeRerolls', perRound: 3 },
		],
	),
	A('DA_GiantAndMighty', '大而有力', '你的队伍体型变大，获得200生命值和10%最大生命值。', 3, [
		{ kind: 'teamBuff', hpFlat: 200, hpPct: 0.1 },
	]),
	A('DA_HedgeFund', '对冲基金', '获得22金币。你的最大利息提升至10金币。', 3, [
		{ kind: 'goldNow', amount: 22 },
		{ kind: 'interestCap', add: 5 },
	]),
	A(
		'DA_InvestmentStrategy',
		'投资策略 II',
		'你每获得1利息，你的弈子们获得10永久最大生命值。你的最大利息提升2。立刻获得8金币。',
		3,
		[
			{ kind: 'teamHpPerInterest', amount: 10 },
			{ kind: 'interestCap', add: 2 },
			{ kind: 'goldNow', amount: 8 },
		],
	),
	A('DA_MoneyMonsoon', '摇钱树', '立刻并在剩余游戏时间内每回合获得7金币。', 3, [
		{ kind: 'goldNow', amount: 7 },
		{ kind: 'roundGold', amount: 7 },
	]),
	A('DA_PrismaticDestiny', '棱彩命运', '获得1个随机棱彩阶强化符文和4金币。', 3, [
		{ kind: 'randomAugment', tier: 3 },
		{ kind: 'goldNow', amount: 4 },
	]),
	A('DA_PrismaticDestinyPlus', '棱彩命运+', '获得1个随机棱彩阶强化符文和7金币。', 3, [
		{ kind: 'randomAugment', tier: 3 },
		{ kind: 'goldNow', amount: 7 },
	]),
	A('TFT11_Augment_Buildabud', '来个好伙计', '获得1个随机3星1费弈子。获得10金币。', 3, [
		{ kind: 'randomChamps', cost: 1, count: 1, star: 3 },
		{ kind: 'goldNow', amount: 10 },
	]),
	A('TFT11_Augment_TinyButDeadly', '小而致命', '你的队伍体型变小，获得33%攻击速度和移动速度。', 3, [
		{ kind: 'teamBuff', asPct: 0.33 },
	]),
	A(
		'TFT6_Augment_RadiantRelics',
		'光明圣物',
		'从5件光明武器中选出1件。获得1个【装备拆卸器】。',
		3,
		[
			{ kind: 'armoryNow', pool: 'radiant', options: 5 },
			{ kind: 'consumablesNow', removers: 1 },
		],
	),
	A(
		'TFT6_Augment_TradeSector2',
		'贸易中心',
		'立刻获得16次免费商店刷新，并在剩余游戏时间内每回合获得3次免费商店刷新。',
		3,
		[
			{ kind: 'rerollsNow', count: 16 },
			{ kind: 'freeRerolls', perRound: 3 },
		],
	),
	A(
		'TFT7_Augment_LivingForge',
		'活体锻炉',
		'立刻以及之后的每9个玩家对战回合后获得1个【神器锻造器】。',
		3,
		[
			{ kind: 'armoryNow', pool: 'artifact' },
			{ kind: 'armoryPerRounds', pool: 'artifact', rounds: 9 },
		],
	),
	A(
		'TFT7_Augment_UrfsGrabBag2',
		'阿福的百宝袋',
		'获得1个【金铲铲】、3个随机基础装备、以及5金币。',
		3,
		[
			{ kind: 'namedItems', apiNames: ['TFT_Item_Spatula'] },
			{ kind: 'components', count: 3 },
			{ kind: 'goldNow', amount: 5 },
		],
	),
	A(
		'TFT9_Augment_BuildingACollectionPlusPlus',
		'珍藏财宝',
		'立刻以及接下来的5个回合开始时，获得1个随机基础装备。',
		3,
		[
			{ kind: 'components', count: 1 },
			{ kind: 'delayRandom', rounds: 1, repeat: true, components: 1 },
		],
	),
	A('TFT9_Augment_HedgeFund', '对冲基金', '获得22金币。你的最大利息提升至10金币。', 3, [
		{ kind: 'goldNow', amount: 22 },
		{ kind: 'interestCap', add: 5 },
	]),
	A('TFT9_Augment_HedgeFundPlus', '对冲基金+', '获得30金币。你的最大利息提升至10金币。', 3, [
		{ kind: 'goldNow', amount: 30 },
		{ kind: 'interestCap', add: 5 },
	]),
	A(
		'TFT9_Augment_PandorasRadiantBox',
		'潘朵拉的装备 III',
		'回合开始时：你备战席上的装备会随机变化。获得1件随机光明武器。',
		3,
		[{ kind: 'pandoraTray' }, { kind: 'randomRadiant', count: 1 }],
	),
	A(
		'TFT_Augment_Coronation',
		'加冕礼',
		'获得1个【金铲铲冠冕】。【金铲铲冠冕】、【金锅锅冠冕】、和【金锅铲冠冕】为携带者提供额外的20%攻击速度、25%物理加成和30%法术加成。',
		3,
		[
			{ kind: 'namedItems', apiNames: ['DA_TacticiansCrown'] },
			{ kind: 'holderBuff', match: 'crown', asPct: 0.2, adPct: 0.25, apPct: 30 },
		],
	),
	A(
		'TFT_Augment_ForgedInStrength',
		'神力天铸',
		'获得1个随机神器。当你降至30生命值时，额外获得3个随机神器。2023【强音争霸】全球总决赛',
		3,
		[
			{ kind: 'randomArtifacts', count: 1 },
			{ kind: 'hpThresholdItems', hp: 30, artifacts: 3 },
		],
	),
	A(
		'TFT_Augment_GoldenGamble',
		'黄金赌约',
		'获得2金币，并抛一枚硬币。如果硬币正面朝上，获得1个光明版幸运装备宝箱。如果硬币反面朝上，获得2个成装锻造器。@TFTUnitProperty.item:TFT_Augment_GoldenGamble_Tooltip@',
		3,
		[{ kind: 'coinFlipArmory', gold: 2, tailsPool: 'completed', tailsCount: 2 }],
	),
	A(
		'TFT_Augment_GoldenGamblePlus',
		'黄金赌约+',
		'获得3金币，并抛一枚硬币。如果硬币正面朝上，获得1个光明版幸运装备宝箱。如果硬币反面朝上，获得2个成装锻造器。@TFTUnitProperty.item:TFT_Augment_GoldenGamble_Tooltip@',
		3,
		[{ kind: 'coinFlipArmory', gold: 3, tailsPool: 'completed', tailsCount: 2 }],
	),
	A(
		'TFT_Augment_GoldenGamblePlusPlus',
		'黄金赌约++',
		'获得6金币，并抛一枚硬币。如果硬币正面朝上，获得1个光明版幸运装备宝箱。如果硬币反面朝上，获得2个成装锻造器。@TFTUnitProperty.item:TFT_Augment_GoldenGamble_Tooltip@',
		3,
		[{ kind: 'coinFlipArmory', gold: 6, tailsPool: 'completed', tailsCount: 2 }],
	),
	A(
		'TFT_Augment_HardCommit',
		'硬性承诺',
		'获得1个随机纹章。现在以及每个阶段开始时，获得该羁绊的一个1星弈子，且该弈子的费用相当于当前阶段数(最多为5)，并获得3金币。',
		3,
		[
			{ kind: 'randomEmblems', count: 1 },
			{ kind: 'stageEmblemChamp', gold: 3 },
		],
	),
	A(
		'TFT_Augment_MuseumHeist',
		'散件丰收日',
		'在6场玩家对战回合后，获得所有的基础装备各一件。即刻获得一件随机的基础装备。@TFTUnitProperty.item:TFT_Augment_MuseumHeist_TooltipTRAKey@@TFTUnitProperty.item:TFT_Augment_MuseumHeist_CompleteTRAKey@',
		3,
		[
			{ kind: 'components', count: 1 },
			{ kind: 'delayRandom', rounds: 6, components: 8 },
		],
	),
	A(
		'TFT_Augment_SweetTreats',
		'甜点',
		'获得1个【神器锻造器】。弈子每携带1个装备，你的队伍就获得16生命值。已获得的生命值：@TFTUnitProperty.item:TFT_Augment_SweetTreats_TeamHealth@2024【魔法大乱斗】全球总决赛',
		3,
		[
			{ kind: 'armoryNow', pool: 'artifact' },
			{ kind: 'teamHpPerItem', amount: 16 },
		],
	),
	A('TFT_Augment_TraitTree', '羁绊树', '获得3个随机纹章、一个【装备重铸器】和2金币。', 3, [
		{ kind: 'randomEmblems', count: 3 },
		{ kind: 'goldNow', amount: 2 },
	]),
	A('TFT_Augment_TraitTreePlus', '羁绊树+', '获得3个随机纹章、一个【装备重铸器】和4金币。', 3, [
		{ kind: 'randomEmblems', count: 3 },
		{ kind: 'consumablesNow', rerollers: 1 },
		{ kind: 'goldNow', amount: 4 },
	]),
	A(
		'TFT_Augment_UnlimitedPower',
		'能量解限',
		'获得1个【纳什之牙】、1个【珠光护手】、1个【无用大棒】、和1个【装备拆卸器】。',
		3,
		[
			{
				kind: 'namedItems',
				apiNames: ['DA_NashorsTooth', 'DA_JeweledGauntlet', 'TFT_Item_NeedlesslyLargeRod'],
			},
			{ kind: 'consumablesNow', removers: 1 },
		],
	),
	A(
		'TFT_Augment_WeStickTogether',
		'水乳交融',
		'获得1个随机纹章和1个【成装锻造器】。与该纹章有同一羁绊的己方弈子们获得30%攻击速度。@TFTUnitProperty.item:TFT_Augment_WeStickTogether_Tooltip@2025【双城之战2】全球总决赛',
		3,
		[
			{ kind: 'randomEmblems', count: 1 },
			{ kind: 'armoryNow', pool: 'completed' },
			{ kind: 'emblemSynergyBuff', asPct: 0.3 },
		],
	),
	// ---- round3 引擎扩展补录：白银 ----
	A('DA_ChampDelivery', '弈子配送', '获得3个2费弈子。在6个回合后，再获得3个。', 1, [
		{ kind: 'randomChamps', cost: 2, count: 3 },
		{ kind: 'delayRandom', rounds: 6, champs: [{ cost: 2, count: 3 }] },
	]),
	A('DA_ChampDeliveryPlus', '弈子配送+', '获得3个3费弈子。在6个回合后，再获得3个。', 1, [
		{ kind: 'randomChamps', cost: 3, count: 3 },
		{ kind: 'delayRandom', rounds: 6, champs: [{ cost: 3, count: 3 }] },
	]),
	A('DA_ChampDeliveryPlusPlus', '弈子配送++', '获得3个4费弈子。在6个回合后，再获得3个。', 1, [
		{ kind: 'randomChamps', cost: 4, count: 3 },
		{ kind: 'delayRandom', rounds: 6, champs: [{ cost: 4, count: 3 }] },
	]),
	A('DA_LateGameSpecialist', '后期专家', '当你到达9级时，获得27金币。', 1, [
		{ kind: 'armoryAtLevels', levels: [9], gold: 27 },
	]),
	A('TFT7_Augment_LategameSpecialist', '后期专家', '在你到达9级时，提供27金币。', 1, [
		{ kind: 'armoryAtLevels', levels: [9], gold: 27 },
	]),
	A(
		'DA_TeamBuilding',
		'团队建设',
		'获得1个【次级英雄复制器】。在5场玩家对战回合后获得另一个。这个物品允许你能复制1个3费或以下的弈子。',
		1,
		[
			{ kind: 'consumablesNow', lesserDuplicators: 1 },
			{ kind: 'delayRandom', rounds: 5, lesserDuplicators: 1 },
		],
	),
	A(
		'TFT9_Augment_ArmyBuilding',
		'团队建设',
		'获得1个【次级英雄复制器】。在5个玩家对战回合后获得另一个。这个物品允许你能复制一个3费或以下的弈子。',
		1,
		[
			{ kind: 'consumablesNow', lesserDuplicators: 1 },
			{ kind: 'delayRandom', rounds: 5, lesserDuplicators: 1 },
		],
	),
	// ---- round3 引擎扩展补录：黄金 ----
	A(
		'DA_BirthdayPresent',
		'生日礼物',
		'在你每次升级时提供1个2星弈子和1金币。这个弈子的费用位阶是你的等级减4(最大值：5费)。',
		2,
		[
			{
				kind: 'armoryAtLevels',
				levels: [],
				everyLevel: true,
				gold: 1,
				levelChamp: { star: 2, costOffset: 4, maxCost: 5 },
			},
		],
	),
	A(
		'TFT7_Augment_BirthdayPresents',
		'生日礼物',
		'在你每次升级时提供1个2星弈子和1金币。这个弈子的费用位阶是你的等级减4(最大值：5费)。',
		2,
		[
			{
				kind: 'armoryAtLevels',
				levels: [],
				everyLevel: true,
				gold: 1,
				levelChamp: { star: 2, costOffset: 4, maxCost: 5 },
			},
		],
	),
	A(
		'DA_CyberneticImplants_Gold',
		'源计划植入',
		'那些携带1件装备的友军获得100生命值和15%物理加成。获得1个【暴风大剑】。',
		2,
		[
			{ kind: 'holderBuff', itemCount: 1, hpFlat: 100, adPct: 0.15 },
			{ kind: 'namedItems', apiNames: ['TFT_Item_BFSword'] },
		],
	),
	A(
		'TFT6_Augment_CyberneticImplants2',
		'源计划植入',
		'那些携带1件装备的友军获得100生命值和15%物理加成。获得1个【暴风大剑】。',
		2,
		[
			{ kind: 'holderBuff', itemCount: 1, hpFlat: 100, adPct: 0.15 },
			{ kind: 'namedItems', apiNames: ['TFT_Item_BFSword'] },
		],
	),
	A(
		'DA_CyberneticUplink_Gold',
		'源计划上行链路',
		'那些携带1件装备的友军获得100生命值和2法力回复。获得1个【女神之泪】。',
		2,
		[
			{ kind: 'holderBuff', itemCount: 1, hpFlat: 100, manaRegen: 2 },
			{ kind: 'namedItems', apiNames: ['TFT_Item_TearOfTheGoddess'] },
		],
	),
	A(
		'TFT6_Augment_CyberneticUplink2',
		'源计划上行链路',
		'那些携带1件装备的友军获得100生命值和2法力回复。获得1个【女神之泪】。',
		2,
		[
			{ kind: 'holderBuff', itemCount: 1, hpFlat: 100, manaRegen: 2 },
			{ kind: 'namedItems', apiNames: ['TFT_Item_TearOfTheGoddess'] },
		],
	),
	A('DA_ExplosiveGrowth', '爆炸式增长', '立刻以及接下来的3个回合开始时，获得7经验值。', 2, [
		{ kind: 'xpNow', amount: 7 },
		{ kind: 'delayRandom', rounds: 1, repeat: true, times: 3, xp: 7 },
	]),
	A(
		'TFT_Augment_ExplosiveGrowth',
		'爆炸式增长',
		'立刻以及接下来的3个回合开始时，获得7经验值。',
		2,
		[
			{ kind: 'xpNow', amount: 7 },
			{ kind: 'delayRandom', rounds: 1, repeat: true, times: 3, xp: 7 },
		],
	),
	A('DA_ExplosiveGrowthPlus', '爆炸式增长+', '立刻以及接下来的3个回合开始时，获得10经验值。', 2, [
		{ kind: 'xpNow', amount: 10 },
		{ kind: 'delayRandom', rounds: 1, repeat: true, times: 3, xp: 10 },
	]),
	A(
		'TFT_Augment_ExplosiveGrowthPlus',
		'爆炸式增长+',
		'立刻以及接下来的3个回合开始时，获得10经验值。',
		2,
		[
			{ kind: 'xpNow', amount: 10 },
			{ kind: 'delayRandom', rounds: 1, repeat: true, times: 3, xp: 10 },
		],
	),
	A('DA_HeroicGrabBag', '英勇福袋', '获得2个【次级英雄复制器】。获得4金币。', 2, [
		{ kind: 'consumablesNow', lesserDuplicators: 2 },
		{ kind: 'goldNow', amount: 4 },
	]),
	A('DA_HeroicGrabBagPlus', '英勇福袋+', '获得2个【次级英雄复制器】。获得8金币。', 2, [
		{ kind: 'consumablesNow', lesserDuplicators: 2 },
		{ kind: 'goldNow', amount: 8 },
	]),
	A('DA_HeroicGrabBagPlusPlus', '英勇福袋++', '获得2个【次级英雄复制器】。获得14金币。', 2, [
		{ kind: 'consumablesNow', lesserDuplicators: 2 },
		{ kind: 'goldNow', amount: 14 },
	]),
	A(
		'TFT10_Augment_HeroicGrabBag',
		'英勇福袋',
		'获得2个【次级英雄复制器】和5金币。这个物品允许你能复制一个3费或以下的弈子。',
		2,
		[
			{ kind: 'consumablesNow', lesserDuplicators: 2 },
			{ kind: 'goldNow', amount: 5 },
		],
	),
	A(
		'TFT_Augment_HeroicGrabBagPlus',
		'英勇福袋+',
		'获得2个【次级英雄复制器】和8金币。这个物品允许你能复制一个3费或以下的弈子。',
		2,
		[
			{ kind: 'consumablesNow', lesserDuplicators: 2 },
			{ kind: 'goldNow', amount: 8 },
		],
	),
	A(
		'TFT_Augment_HeroicGrabBagPlusPlus',
		'英勇福袋++',
		'获得2个【次级英雄复制器】和14金币。这个物品允许你能复制一个3费或以下的弈子。',
		2,
		[
			{ kind: 'consumablesNow', lesserDuplicators: 2 },
			{ kind: 'goldNow', amount: 14 },
		],
	),
	// ---- round3 引擎扩展补录：棱彩 ----
	A(
		'TFT6_Augment_BandOfThieves2',
		'窃贼帮派 II',
		'获得2个【窃贼手套】。在6场玩家对战回合后，获得另一个。',
		3,
		[
			{ kind: 'namedItems', apiNames: ['DA_ThiefsGloves', 'DA_ThiefsGloves'] },
			{ kind: 'delayRandom', rounds: 6, items: ['DA_ThiefsGloves'] },
		],
	),
	A(
		'TFT6_Augment_BandOfThieves2Plus',
		'窃贼帮派 II+',
		'获得2个【窃贼手套】。在5场玩家对战回合后，获得另一个。',
		3,
		[
			{ kind: 'namedItems', apiNames: ['DA_ThiefsGloves', 'DA_ThiefsGloves'] },
			{ kind: 'delayRandom', rounds: 5, items: ['DA_ThiefsGloves'] },
		],
	),
	A(
		'TFT6_Augment_BandOfThieves2PlusPlus',
		'窃贼帮派 II++',
		'获得2个【窃贼手套】。在3场玩家对战回合后，获得另一个。',
		3,
		[
			{ kind: 'namedItems', apiNames: ['DA_ThiefsGloves', 'DA_ThiefsGloves'] },
			{ kind: 'delayRandom', rounds: 3, items: ['DA_ThiefsGloves'] },
		],
	),
	A(
		'TFT6_Augment_CyberneticUplink3',
		'源计划上行链路 III',
		'那些携带1件装备的友军获得275生命值和3法力回复。获得1个【女神之泪】。',
		3,
		[
			{ kind: 'holderBuff', itemCount: 1, hpFlat: 275, manaRegen: 3 },
			{ kind: 'namedItems', apiNames: ['TFT_Item_TearOfTheGoddess'] },
		],
	),
	A(
		'DA_OneBuffTwoBuff',
		'1个霸符，2个霸符',
		'获得1个【红霸符】、1个【蓝霸符】和1个【英雄复制器】。',
		3,
		[
			{ kind: 'namedItems', apiNames: ['DA_RedBuff', 'DA_BlueBuff'] },
			{ kind: 'consumablesNow', duplicators: 1 },
		],
	),
	A(
		'TFT_Augment_OneBuffTwoBuff',
		'1个霸符，2个霸符',
		'获得1个【红霸符】、1个【蓝霸符】和1个【英雄复制器】。',
		3,
		[
			{ kind: 'namedItems', apiNames: ['DA_RedBuff', 'DA_BlueBuff'] },
			{ kind: 'consumablesNow', duplicators: 1 },
		],
	),
	A(
		'DA_Retribution',
		'正义报复',
		'获得2个【正义之手】。携带【正义之手】的友军获得技能暴击和25%暴击几率。',
		3,
		[
			{ kind: 'namedItems', apiNames: ['DA_HandOfJustice', 'DA_HandOfJustice'] },
			{ kind: 'holderBuff', item: 'DA_HandOfJustice', abilityCrit: true, critChance: 0.25 },
		],
	),
	A(
		'TFT_Augment_Retribution',
		'正义报复',
		'获得2个【正义之手】。携带【正义之手】的友军获得技能暴击和25%暴击几率。',
		3,
		[
			{ kind: 'namedItems', apiNames: ['DA_HandOfJustice', 'DA_HandOfJustice'] },
			{ kind: 'holderBuff', item: 'DA_HandOfJustice', abilityCrit: true, critChance: 0.25 },
		],
	),
	A(
		'DA_TacticiansKitchen',
		'锅铲厨房',
		'获得1个随机纹章。在3个回合后，获得1个【金锅铲冠冕】。',
		3,
		[
			{ kind: 'randomEmblems', count: 1 },
			{ kind: 'delayRandom', rounds: 3, items: ['DA_TacticiansCrown'] },
		],
	),
	A(
		'TFT_Augment_TacticiansKitchen',
		'锅铲厨房',
		'获得1个随机纹章。在3个回合后，获得1个【金锅铲冠冕】。',
		3,
		[
			{ kind: 'randomEmblems', count: 1 },
			{ kind: 'delayRandom', rounds: 3, items: ['DA_TacticiansCrown'] },
		],
	),
	// ---- round4：属性维度/条件加成/回合钩子 ----
	A('DA_MakeshiftArmorI', '应急护甲 I', '没有携带任何装备的弈子获得30护甲和魔抗。', 1, [
		{ kind: 'condBuff', when: 'noItems', armor: 30, mr: 30 },
	]),
	A(
		'DA_GlassCannon_Silver',
		'玻璃大炮 I',
		'在后排开始战斗的友军，在战斗开始时的生命值为80%，但会获得16%伤害增幅。',
		1,
		[{ kind: 'condBuff', when: 'backRow', hpPct: -0.2, damageAmp: 0.16 }],
	),
	A(
		'TFT6_Augment_Distancing',
		'浪人 I',
		'战斗开始时，你的邻格内没有弈子的单位获得相当于其20%最大生命值的护盾值，持续10秒。',
		1,
		[{ kind: 'condBuff', when: 'noNeighborAlly', shieldPct: 0.2 }],
	),
	A(
		'DA_ClearMind',
		'清晰头脑',
		'如果在玩家对战回合结束时，你的备战席没有任何弈子，则获得3经验值。',
		1,
		[{ kind: 'roundEndXp', when: 'benchEmpty', amount: 3 }],
	),
	A(
		'DA_CelestialBlessingI',
		'星界赐福 I',
		'你的队伍获得12%全能吸血。溢出的治疗量会转换为护盾，至多转化为200生命值护盾。',
		1,
		[{ kind: 'teamBuff', omnivamp: 0.12 }],
	),
	A('TFT6_Augment_TinyTitans', '小巨人', '使你的当前玩家生命值和最大玩家生命值都提升20。', 1, [
		{ kind: 'playerHp', amount: 20 },
	]),
	A(
		'DA_Slammin',
		'物尽其用',
		'获得3金币。在每场玩家对战回合结束时，如果你的备战席没有任何装备(消耗品除外)，获得2经验值。',
		1,
		[
			{ kind: 'goldNow', amount: 3 },
			{ kind: 'roundEndXp', when: 'benchNoItems', amount: 2 },
		],
	),
	A(
		'DA_ClutteredMind',
		'纷乱头脑',
		'立刻获得4个1费弈子。如果在玩家对战回合结束时，你的备战席已满，则获得3经验值。',
		1,
		[
			{ kind: 'randomChamps', cost: 1, count: 4 },
			{ kind: 'roundEndXp', when: 'benchFull', amount: 3 },
		],
	),
	A(
		'DA_WorththeWait',
		'值得等待',
		'获得1个随机1费弈子。每回合开始时都会获得该弈子的又一个1星复制体，持续至本局游戏结束。',
		1,
		[{ kind: 'worthTheWait', cost: 1, copies: 1 }],
	),
	A(
		'DA_PatientStudy',
		'耐心学习',
		'在玩家对战回合后，如果你赢了则获得3经验值，如果你输了则获得2经验值。',
		1,
		[{ kind: 'combatResultXp', win: 3, lose: 2 }],
	),
	A('DA_MakeshiftArmorII', '应急护甲 II', '没有携带任何装备的弈子获得50护甲和魔抗。', 2, [
		{ kind: 'condBuff', when: 'noItems', armor: 50, mr: 50 },
	]),
	A(
		'TFT6_Augment_Distancing2',
		'浪人 II',
		'战斗开始时，你的邻格内没有弈子的单位获得相当于其30%最大生命值的护盾值，持续10秒。',
		2,
		[{ kind: 'condBuff', when: 'noNeighborAlly', shieldPct: 0.3 }],
	),
	A(
		'DA_GlassCannon_Gold',
		'玻璃大炮 II',
		'在后排开始战斗的友军，在战斗开始时的生命值为80%，但会获得25%伤害增幅。',
		2,
		[{ kind: 'condBuff', when: 'backRow', hpPct: -0.2, damageAmp: 0.25 }],
	),
	A(
		'TFT9_PumpingUp',
		'打气 I',
		'你的队伍获得6%攻击速度。在之后的每个回合，他们额外获得0.5%攻击速度。',
		2,
		[{ kind: 'rampBuff', per: 'round', asPct: 0.005, initialStacks: 12 }],
	),
	A(
		'TFT9_PumpingUp2',
		'打气 II',
		'你的队伍获得10%攻击速度。在之后的每个回合，他们额外获得1%攻击速度。',
		2,
		[{ kind: 'rampBuff', per: 'round', asPct: 0.01, initialStacks: 10 }],
	),
	A(
		'DA_EarlyLearnings',
		'宝宝学院',
		'你的队伍获得5%物理加成和法术加成。在每场玩家对战回合结束后，该加成提升1%。1费弈子们获得双倍该加成。',
		2,
		[{ kind: 'rampBuff', per: 'pvp', adPct: 0.01, apPct: 0.01, initialStacks: 5 }],
	),
	A('DA_LevelUp', '升级咯！', '在你购买经验值时，获得额外2经验值。立刻获得6经验值。', 2, [
		{ kind: 'xpNow', amount: 6 },
		{ kind: 'buyXpBonus', amount: 2 },
	]),
	A(
		'DA_Hustler',
		'花到上头',
		'你不再获得利息，但会在每个玩家对战回合开始时获得3金币。立刻获得3金币。利息是你每储存10金币时获得的额外金币。',
		2,
		[{ kind: 'goldNow', amount: 3 }, { kind: 'noInterest' }, { kind: 'roundStartGold', amount: 3 }],
	),
	A(
		'DA_GoingLong',
		'遥遥领先',
		'你不再获得利息。立刻获得10金币。在每场玩家对战后，获得4经验值。利息是你每储存10金币时获得的额外金币。',
		2,
		[{ kind: 'goldNow', amount: 10 }, { kind: 'noInterest' }, { kind: 'roundStartXp', amount: 4 }],
	),
	A(
		'DA_UpwardMobility',
		'上进心',
		'购买经验值的费用减少1。每当你升级时，获得2生命值和2次刷新。',
		2,
		[
			{ kind: 'xpCostDiscount', amount: 1 },
			{ kind: 'levelUpBonus', hp: 2, rerolls: 2 },
		],
	),
	A(
		'DA_ShoppingSpree',
		'大买特买',
		'在你升级时，获得相当于你等级数+1的商店刷新次数。获得6金币。',
		2,
		[
			{ kind: 'goldNow', amount: 6 },
			{ kind: 'levelUpBonus', rerolls: 1, rerollsPerLevel: 1 },
		],
	),
	A('DA_Epoch', '新纪元', '立刻以及每阶段开始时，获得4经验值和2次免费刷新。', 2, [
		{ kind: 'stageKit', xp: 4, rerolls: 2 },
	]),
	A(
		'DA_BandOfThievesII',
		'窃贼帮派 II',
		'获得2个【窃贼手套】。在5场玩家对战回合后，获得另一个。',
		2,
		[
			{ kind: 'namedItems', apiNames: ['DA_ThiefsGloves', 'DA_ThiefsGloves'] },
			{ kind: 'delayRandom', rounds: 5, items: ['DA_ThiefsGloves'] },
		],
	),
	A(
		'DA_CelestialBlessingII',
		'星界赐福 II',
		'你的队伍获得18%全能吸血。溢出的治疗量会转换为护盾，至多转化为400生命值护盾。',
		2,
		[{ kind: 'teamBuff', omnivamp: 0.18 }],
	),
	A('TFT_Augment_GuardbreakerSpirit', '权杖意志', '获得1个【拳套】。你的队伍获得25%暴击几率。', 2, [
		{ kind: 'namedItems', apiNames: ['TFT_Item_SparringGloves'] },
		{ kind: 'teamBuff', critChance: 0.25 },
	]),
	A(
		'TFT_Augment_HeftyRolls',
		'大刷特刷',
		'你在这局游戏每次刷新时，你的队伍就会获得8生命值和体型。获得5金币。',
		2,
		[
			{ kind: 'goldNow', amount: 5 },
			{ kind: 'rerollRamp', hpFlat: 8 },
		],
	),
	A(
		'TFT_Augment_Unforgotten',
		'猛将的荣耀',
		'每回合，你的队伍获得5%物理加成和法术加成。英雄们初始拥有1层此效果，并且至多可叠加至4层。',
		2,
		[{ kind: 'rampBuff', per: 'round', adPct: 0.05, apPct: 0.05, initialStacks: 1, maxStacks: 4 }],
	),
	A(
		'TFT_Augment_TitanicTitan',
		'巨型泰坦',
		'使你的当前和最大玩家生命值都提升25。你会在选秀中更早被放出，但速度要慢得多。',
		2,
		[{ kind: 'playerHp', amount: 25 }],
	),
	A(
		'DA_FindYourCenter',
		'C位的觉悟',
		'战斗开始时，位于棋盘中心的那个己方弈子获得15%伤害增幅和25%最大生命值。',
		2,
		[{ kind: 'condBuff', when: 'frontCenter', damageAmp: 0.15, hpPct: 0.25 }],
	),
	A(
		'DA_TwinGuardians',
		'双子守护神',
		'如果你的第一排有且只有2名友军，为他们提供100生命值、35护甲和35魔法抗性。',
		2,
		[{ kind: 'condBuff', when: 'frontRowOnly', frontCount: 2, hpFlat: 100, armor: 35, mr: 35 }],
	),
	A(
		'DA_WorththeWaitII',
		'值得等待 II',
		'获得1个随机2费弈子的2个1星复制体。每回合开始时都会获得该弈子的又一个1星复制体，持续至本局游戏结束。',
		2,
		[{ kind: 'worthTheWait', cost: 2, copies: 2 }],
	),
	A(
		'TFT9_PumpingUp3',
		'打气 III',
		'你的队伍获得16%攻击速度。在之后的每个回合，他们额外获得2%攻击速度。',
		3,
		[{ kind: 'rampBuff', per: 'round', asPct: 0.02, initialStacks: 8 }],
	),
	A(
		'DA_JeweledLotus_I',
		'珠光莲花 I',
		'你的队伍获得10%暴击几率和技能暴击。【技能暴击】：技能伤害可以造成暴击。',
		3,
		[{ kind: 'teamBuff', critChance: 0.1, abilityCrit: true }],
	),
	A(
		'DA_JeweledLotus_II',
		'珠光莲花 II',
		'你的队伍获得25%暴击几率，10%暴击伤害和【技能暴击】。【技能暴击】：技能伤害可以造成暴击。',
		3,
		[{ kind: 'teamBuff', critChance: 0.25, critMult: 0.1, abilityCrit: true }],
	),
	A(
		'DA_CelestialBlessingIII',
		'星界赐福 III',
		'你的队伍获得25%全能吸血。溢出的治疗量会转换为护盾，至多转化为1000生命值护盾。',
		3,
		[{ kind: 'teamBuff', omnivamp: 0.25 }],
	),
	A('DA_SwordOverflow', '大剑溢流', '获得4个【暴风大剑】。你的【暴风大剑】提供+4%攻击速度。', 3, [
		{
			kind: 'namedItems',
			apiNames: ['TFT_Item_BFSword', 'TFT_Item_BFSword', 'TFT_Item_BFSword', 'TFT_Item_BFSword'],
		},
		{ kind: 'holderBuff', item: 'TFT_Item_BFSword', asPct: 0.04 },
	]),
	A('DA_WandOverflow', '法杖溢流', '获得4个【无用大棒】。你的【无用大棒】提供+5%攻击速度。', 3, [
		{
			kind: 'namedItems',
			apiNames: [
				'TFT_Item_NeedlesslyLargeRod',
				'TFT_Item_NeedlesslyLargeRod',
				'TFT_Item_NeedlesslyLargeRod',
				'TFT_Item_NeedlesslyLargeRod',
			],
		},
		{ kind: 'holderBuff', item: 'TFT_Item_NeedlesslyLargeRod', asPct: 0.05 },
	]),
	A('DA_BeltOverflow', '腰带溢流', '获得4个【巨人腰带】。你的【巨人腰带】提供+85额外生命值。', 3, [
		{
			kind: 'namedItems',
			apiNames: [
				'TFT_Item_GiantsBelt',
				'TFT_Item_GiantsBelt',
				'TFT_Item_GiantsBelt',
				'TFT_Item_GiantsBelt',
			],
		},
		{ kind: 'holderBuff', item: 'TFT_Item_GiantsBelt', hpFlat: 85 },
	]),
	A('DA_PartialAscension', '部分飞升', '在战斗开始12秒后，你的单位们获得20%伤害增幅。', 1, [
		{ kind: 'combatTimer', after: 12, damageAmp: 0.2 },
	]),
	A('DA_Ascension', '飞升', '在战斗开始12秒后，你的单位们获得35%伤害增幅。', 1, [
		{ kind: 'combatTimer', after: 12, damageAmp: 0.35 },
	]),
	A(
		'TFT9_Augment_Commander_FinalAscension',
		'终极飞升',
		'己方弈子获得20%伤害增幅。在15秒后，这个效果提升至60%伤害增幅。',
		3,
		[
			{ kind: 'teamBuff', damageAmp: 0.2 },
			{ kind: 'combatTimer', after: 15, damageAmp: 0.4 },
		],
	),
	A('DA_ClockworkAccelerator', '发条增速器', '你的队伍在战斗中每过3秒就会获得10%攻击速度。', 2, [
		{ kind: 'combatTimer', after: 3, every: true, asPct: 0.1 },
	]),
	A('DA_HealingOrbsI', '治疗法球 I', '当1名敌人阵亡时，1名附近的友军治疗250生命值。', 1, [
		{ kind: 'deathHeal', amount: 250 },
	]),
	A('DA_HealingOrbsII', '治疗法球 II', '当1名敌人阵亡时，1名附近的友军治疗575生命值。', 2, [
		{ kind: 'deathHeal', amount: 575 },
	]),
	A('TFT9_Augment_DravenSpoilsOfWar', '战争财宝 I', '敌人在被击杀时有25%几率掉落战利品。', 1, [
		{ kind: 'killLoot', chance: 0.25 },
	]),
	A('TFT9_Augment_DravenSpoilsOfWar2', '战争财宝 II', '敌人在被击杀时有30%几率掉落战利品。', 2, [
		{ kind: 'killLoot', chance: 0.3 },
	]),
	A('TFT9_Augment_DravenSpoilsOfWar3', '战争财宝 III', '敌人在被击杀时有40%几率掉落战利品。', 3, [
		{ kind: 'killLoot', chance: 0.4 },
	]),
	A(
		'DA_Warpath',
		'征战之路',
		'获得1个2星2费弈子。在造成80玩家伤害后，获得1个装有高费弈子们和装备的宝箱。',
		2,
		[
			{ kind: 'randomChamps', cost: 2, count: 1, star: 2 },
			{ kind: 'playerDamageQuest', target: 80, champCount: 3, minCost: 4, itemCount: 2 },
		],
	),
]

// Plus 强化版（如「认知税+」「窃贼帮派 II++」）为 PVE/特殊模式专属，标记后不参与常规抽取
for (const a of AUGMENTS) {
	if (/Plus/i.test(a.apiName)) a.pveOnly = true
}

/** 每个海克斯回合全员统一品质；权重近似官方（银/金/彩） */
export const AUGMENT_TIER_ODDS: { tier: 1 | 2 | 3; weight: number }[] = [
	{ tier: 1, weight: 35 },
	{ tier: 2, weight: 45 },
	{ tier: 3, weight: 20 },
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
