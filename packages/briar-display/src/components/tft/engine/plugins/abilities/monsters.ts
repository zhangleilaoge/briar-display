import { BOARD_COLS, COMBAT_ROWS } from '../../../data/rules'
import { hexDistance } from '../../hex'
import type { AbilityCtx, AbilityPlugin, PluginUnit } from '../types'

/** 最远敌人（暗影狼跃后排索敌） */
const farthestEnemy = (ctx: AbilityCtx): PluginUnit | null => {
	let far: PluginUnit | null = null
	let best = -1
	for (const e of ctx.enemies()) {
		const d = hexDistance(ctx.unit.cpos, e.cpos)
		if (d > best) {
			best = d
			far = e
		}
	}
	return far
}

/** 同名友军存活数减少即触发（死亡无直接钩子，onTick 近似） */
const watchPack = (ctx: AbilityCtx, names: readonly string[], onLoss: () => void) => {
	const n = ctx.allies().filter((a) => names.includes(a.apiName)).length
	const last = ctx.unit.mem.pack ?? n
	ctx.unit.mem.pack = n
	if (n < last) onLoss()
}

// 暗影狼（大/小）：开战跃至最远敌人身侧
const WOLF_DIVE: AbilityPlugin = {
	onCombatStart(ctx) {
		const far = farthestEnemy(ctx)
		if (far) ctx.dashTo(ctx.unit, far)
	},
}

// 锋喙鸟（大/小）：友方锋喙鸟阵亡时永久提升攻速
const RAZORBEAK_FURY: AbilityPlugin = {
	onTick(ctx) {
		watchPack(ctx, ['TFT_Razorbeak', 'TFT_RazorbeakMini'], () => {
			ctx.unit.stats.attackSpeed += 0.3
		})
	},
}

export const MONSTER_ABILITIES: Record<string, AbilityPlugin> = {
	// 魔像：猛击当前目标，法强加成魔法伤害
	TFT_BlueGolem: {
		cast(ctx) {
			const t = ctx.currentTarget() ?? ctx.nearestEnemy()
			if (!t) return
			ctx.castFx(t.cpos, { spell: 'damage' })
			ctx.damage(t, ctx.unit.stats.abilityPower * 2 * ctx.scaleOf('magic'), 'magic')
		},
	},
	// 远古巨龙：普攻对目标周围 1 格其他敌人造成 50% 魔法溅射
	TFT_ElderDragon: {
		onAttack(ctx, target, dmg) {
			for (const e of ctx.enemiesInRange(target.cpos, 1)) {
				if (e.uid === target.uid) continue
				ctx.damage(e, dmg * 0.5, 'magic')
			}
		},
	},
	// 石甲虫：友方石甲虫阵亡时回复至满生命
	TFT_Krug: {
		onTick(ctx) {
			watchPack(ctx, ['TFT_Krug'], () => ctx.heal(ctx.unit, ctx.unit.stats.maxHp))
		},
	},
	TFT_Murkwolf: WOLF_DIVE,
	TFT_MurkwolfMini: WOLF_DIVE,
	TFT_Razorbeak: RAZORBEAK_FURY,
	TFT_RazorbeakMini: RAZORBEAK_FURY,
	// 峡谷先锋：开战冲锋至最近敌人，对周围 1 格敌人造成 15% 最大生命值魔法伤害并晕眩 1 秒
	TFT_RiftHerald: {
		onCombatStart(ctx) {
			const t = ctx.nearestEnemy()
			if (t) ctx.dashTo(ctx.unit, t)
			const dmg = ctx.unit.stats.maxHp * 0.15
			ctx.castFx(ctx.unit.cpos, { aoe: 1, spell: 'damage' })
			for (const e of ctx.enemiesInRange(ctx.unit.cpos, 1)) {
				ctx.damage(e, dmg, 'magic')
				ctx.applyStatus(e, { kind: 'stun', value: 0, seconds: 1 })
			}
		},
	},
	// 训练假人：无法行动（引擎 noAct），仅占位避免走通用原型
	TFT_TrainingDummy: {},
	// 高塔假人：每 3 秒电击距离最近的 4 个敌人，各造成 5% 最大生命值真实伤害（官方 vars）
	DA_TheTowerDummy: {
		onTick(ctx) {
			if (ctx.t - (ctx.unit.mem.zap ?? 0) < 3) return
			ctx.unit.mem.zap = ctx.t
			const targets = ctx
				.enemies()
				.sort((a, b) => hexDistance(ctx.unit.cpos, a.cpos) - hexDistance(ctx.unit.cpos, b.cpos))
				.slice(0, 4)
			if (targets.length === 0) return
			ctx.castFx(ctx.unit.cpos, { aoe: 99, spell: 'damage' })
			for (const e of targets) ctx.damage(e, e.stats.maxHp * 0.05, 'true')
		},
	},
	// 虚空生物：数值怪，无主动技能
	TFT_Voidspawn: {},
	// 峡谷迅捷蟹：偶尔瞬移到随机空格
	TFT9_SLIME_Crab: {
		onTick(ctx) {
			if (ctx.rng.next() >= 0.005) return
			for (let i = 0; i < 8; i++) {
				const pos = { col: ctx.rng.int(BOARD_COLS), row: ctx.rng.int(COMBAT_ROWS) }
				if (ctx.enemiesInRange(pos, 0).length + ctx.alliesInRange(pos, 0).length > 0) continue
				ctx.teleport(ctx.unit, pos)
				break
			}
		},
	},
}
