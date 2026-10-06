import type { Rng } from '../rng'
import type { Status } from '../status'
import type { CombatStats, HexPos, StarLevel } from '../types'

/** 战斗单位的公开视图（插件可读写 stats/hp/mana 等） */
export interface PluginUnit {
	uid: string
	apiName: string
	star: StarLevel
	side: 'A' | 'B'
	cpos: HexPos
	hp: number
	shield: number
	mana: number
	alive: boolean
	target: string | null
	stats: CombatStats
	statuses: Status[]
	attackCount: number
	castCount: number
	alphaMark?: boolean
	/** 拉克丝（大元素使）选定的羁绊 */
	chosenTrait?: string
	/** 羁绊效能放大（致命丽花：携带纹章者从该羁绊获得额外加成），缺省 1 */
	traitAmp?: Record<string, number>
	/** 自定义运行时数据（插件自由使用，按 uid 隔离） */
	mem: Record<string, number>
}

export type DamageType = 'physical' | 'magic' | 'true'

/** 插件与战斗引擎交互的 API */
export interface AbilityCtx {
	readonly t: number
	readonly rng: Rng
	readonly unit: PluginUnit
	/** 全体存活敌人/友军 */
	enemies(): PluginUnit[]
	allies(): PluginUnit[]
	/** 当前攻击目标（可能阵亡） */
	currentTarget(): PluginUnit | null
	nearestEnemy(from?: PluginUnit): PluginUnit | null
	/** 范围内敌人/友军 */
	enemiesInRange(center: HexPos, radius: number): PluginUnit[]
	alliesInRange(center: HexPos, radius: number): PluginUnit[]
	/** 直线（from→to 方向延伸至棋盘边缘）上的敌人 */
	enemiesOnLine(from: HexPos, to: HexPos): PluginUnit[]
	/** 被最多敌人环绕的格子 */
	densestEnemyHex(): HexPos | null
	/** 敌人最多的直线方向锚点（用于直线技能瞄准） */
	bestLineTarget(): PluginUnit | null

	/** 统一伤害管线（减伤/护盾/暴击/回蓝/处决/击杀钩子） */
	damage(dst: PluginUnit, raw: number, type: DamageType, opts?: { canCrit?: boolean }): number
	heal(dst: PluginUnit, amount: number): void
	shield(dst: PluginUnit, amount: number): void
	/** 施加状态（控制类自动尊重免控） */
	applyStatus(dst: PluginUnit, s: Omit<Status, 'until'> & { seconds: number }): boolean
	/** 净化限制效果 */
	cleanse(u: PluginUnit): void
	/** 限时属性增益（加法式，到期自动回收） */
	buff(u: PluginUnit, mods: Partial<CombatStats>, seconds: number): void
	/** 瞬移到目标邻格（突进） */
	dashTo(u: PluginUnit, target: PluginUnit): boolean
	teleport(u: PluginUnit, pos: HexPos): void
	/** 在附近空格召唤单位（继承阵营）；返回 null = 无空格/超召唤上限 */
	summon(
		apiName: string,
		opts?: { near?: HexPos; hp?: number; ad?: number; star?: StarLevel },
	): PluginUnit | null

	/** 灼烧/击碎（持续真伤 DoT 与双抗削减） */
	burn(dst: PluginUnit, dps: number, seconds: number): void
	shred(dst: PluginUnit, seconds: number): void
	isBurning(u: PluginUnit): boolean

	/** 星级数值：按 1/2/3 星取值 */
	perStar(values: [number, number, number]): number
	/** 物理乘 AD/100、魔法/真实乘 AP/100 */
	scaleOf(type: DamageType): number
	/** 施法主特效（弹道+落点范围） */
	castFx(pos: HexPos, opts?: { aoe?: number; spell?: 'damage' | 'heal' | 'shield' | 'buff' }): void
	/** 追加一条视觉事件 */
	fx(e: {
		type: 'attack' | 'damage' | 'heal' | 'shield' | 'move' | 'summon' | 'status'
		uid: string
		target?: string
		value?: number
		pos?: HexPos
		statusKind?: string
	}): void
	/** 上报跨战斗持久化指标（茂凯叠层/雷恩加尔金币等），记入 CombatResult.metricsX */
	metric(key: string, delta: number): void
}

export interface AbilityPlugin {
	/** 满蓝施放；缺省走通用原型 */
	cast?(ctx: AbilityCtx): void
	/** 战斗开始时（被动） */
	onCombatStart?(ctx: AbilityCtx): void
	/** 普攻命中后（追加效果） */
	onAttack?(ctx: AbilityCtx, target: PluginUnit, dmg: number): void
	/** 普攻伤害改写（返回最终 raw 伤害，用于爆头/双重打击等） */
	modifyAttack?(ctx: AbilityCtx, target: PluginUnit, raw: number): number
	/** 造成伤害后（击中附伤/灼烧蔓延等）；amount 为实际结算伤害 */
	onDealDamage?(ctx: AbilityCtx, dst: PluginUnit, type: DamageType, amount?: number): void
	/** 参与击杀（目标死于己方伤害时，对伤害来源触发） */
	onKill?(ctx: AbilityCtx, victim: PluginUnit): void
	/** 阵亡时（亡语） */
	onDeath?(ctx: AbilityCtx): void
	/** 受到伤害后（护盾破碎/树苗/怒气等） */
	onDamaged?(ctx: AbilityCtx, amount: number, source: PluginUnit | null): void
	/** 友军受到伤害后（迅捷蟹霸符等全场监听） */
	onAllyDamaged?(ctx: AbilityCtx, ally: PluginUnit, amount: number): void
	/** 每 tick（0.1s）：引导/光环/怒气 */
	onTick?(ctx: AbilityCtx): void
}

/** 羁绊战斗插件：按羁绊 apiName 注册 */
export interface TraitCombatPlugin {
	onCombatStart?(side: 'A' | 'B', units: PluginUnit[], ctx: TraitCtx): void
	onTick?(side: 'A' | 'B', units: PluginUnit[], ctx: TraitCtx): void
	onKill?(side: 'A' | 'B', killer: PluginUnit, victim: PluginUnit, ctx: TraitCtx): void
	onDeath?(side: 'A' | 'B', u: PluginUnit, ctx: TraitCtx): void
	onCast?(side: 'A' | 'B', u: PluginUnit, ctx: TraitCtx): void
	onAttack?(side: 'A' | 'B', u: PluginUnit, target: PluginUnit, ctx: TraitCtx): void
	onDealDamage?(
		side: 'A' | 'B',
		src: PluginUnit,
		dst: PluginUnit,
		type: DamageType,
		amount: number,
		ctx: TraitCtx,
	): void
	onDamaged?(side: 'A' | 'B', u: PluginUnit, amount: number, ctx: TraitCtx): void
}

export interface TraitCtx extends Omit<AbilityCtx, 'unit' | 'currentTarget' | 'nearestEnemy'> {
	/** 本场激活的全部羁绊变量（`${apiName}.${var}` 前缀键） */
	params: Record<string, number>
	sideUnits(side: 'A' | 'B'): PluginUnit[]
}

/** 每场战斗实例化一次（插件可持有闭包状态）；params = 当前档位官方 vars */
export type TraitPluginFactory = (
	params: Record<string, number>,
	breakpointIndex: number,
) => TraitCombatPlugin
