import {
	BUY_XP_AMOUNT,
	BUY_XP_COST,
	DEFAULT_PASSIVE,
	INTEREST_MAX,
	INTEREST_STEP,
	MAX_LEVEL,
	STAGE1_PASSIVE,
	STAGE_BASE_DAMAGE,
	STREAK_GOLD,
	SURVIVOR_DAMAGE,
	WIN_GOLD,
	XP_PER_LEVEL,
} from '../data/rules'
import { AUGMENT_BY_API } from '../data/set18/augments'
import type { PlayerState } from './types'

type AugmentHolder = Pick<PlayerState, 'augments'>

const augmentEffects = <T>(p: AugmentHolder | undefined, kind: string) =>
	(p?.augments ?? [])
		.flatMap((a) => AUGMENT_BY_API.get(a)?.effects ?? [])
		.filter((e) => e.kind === kind) as unknown as T[]

/** 利息上限 = 基础 5 + 海克斯加成 */
export const interestCap = (p?: AugmentHolder) =>
	INTEREST_MAX + augmentEffects<{ add: number }>(p, 'interestCap').reduce((s, e) => s + e.add, 0)

export const interestGold = (gold: number, p?: AugmentHolder) =>
	Math.min(Math.floor(gold / INTEREST_STEP), interestCap(p))

export function streakGold(count: number): number {
	for (const [threshold, gold] of STREAK_GOLD) {
		if (count >= threshold) return gold
	}
	return 0
}

export const passiveIncome = (stage: number, round: number) =>
	stage === 1 ? (STAGE1_PASSIVE[round] ?? 0) : DEFAULT_PASSIVE

export interface IncomeBreakdown {
	passive: number
	interest: number
	streak: number
	win: number
	/** 海克斯附加收入（胜负奖金、摇钱树每回合金币等） */
	bonus: number
	total: number
}

/** 回合结算收入；wonRound 仅 PVP 回合有值 */
export function roundIncome(
	p: Pick<PlayerState, 'gold' | 'streakCount' | 'augments'>,
	stage: number,
	round: number,
	wonRound: boolean | null,
): IncomeBreakdown {
	const passive = passiveIncome(stage, round)
	const interest = interestGold(p.gold, p)
	const streak = streakGold(p.streakCount)
	const win = wonRound ? WIN_GOLD : 0
	let bonus = augmentEffects<{ amount: number }>(p, 'roundGold').reduce((s, e) => s + e.amount, 0)
	if (wonRound === true) {
		bonus += augmentEffects<{ amount: number }>(p, 'winGold').reduce((s, e) => s + e.amount, 0)
	} else if (wonRound === false) {
		bonus += augmentEffects<{ amount: number }>(p, 'lossGold').reduce((s, e) => s + e.amount, 0)
	}
	return { passive, interest, streak, win, bonus, total: passive + interest + streak + win + bonus }
}

export const xpNeeded = (level: number) =>
	level >= MAX_LEVEL ? Number.POSITIVE_INFINITY : XP_PER_LEVEL[level]

/** 加经验并自动连升；满级清零。返回是否升了级 */
export function applyXp(p: PlayerState, amount: number): boolean {
	if (p.level >= MAX_LEVEL) return false
	p.xp += amount
	let leveled = false
	while (p.level < MAX_LEVEL && p.xp >= xpNeeded(p.level)) {
		p.xp -= xpNeeded(p.level)
		p.level += 1
		leveled = true
	}
	if (p.level >= MAX_LEVEL) p.xp = 0
	return leveled
}

export function buyXp(p: PlayerState): boolean {
	if (p.gold < BUY_XP_COST || p.level >= MAX_LEVEL) return false
	p.gold -= BUY_XP_COST
	applyXp(p, BUY_XP_AMOUNT)
	return true
}

/** 战败扣血 = 阶段基础 + 存活敌棋数 */
export function playerDamage(stage: number, survivingEnemies: number): number {
	const base = STAGE_BASE_DAMAGE[Math.min(stage, STAGE_BASE_DAMAGE.length - 1)]
	return base + survivingEnemies * SURVIVOR_DAMAGE
}
