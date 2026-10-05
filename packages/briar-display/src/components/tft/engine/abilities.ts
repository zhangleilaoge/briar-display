import { ABILITY_ARCHETYPES, type AbilityKind, CHAMPION_BY_API } from '../data/set18'

export interface AbilitySpec {
	kind: AbilityKind
	name: string
	/** magic=法强加成，physical=攻击加成，true=真实 */
	damageType: 'magic' | 'physical' | 'true'
	/** 主数值按星级 1/2/3（伤害/治疗/护盾量） */
	values: [number, number, number]
	/** 0=单体；1=目标周围 1 格；99=全体敌人 */
	aoeRange: number
	dotSeconds: number
	summonCount: number
}

/** 数值缺省时的费用基准（1★），按星级 x1.8 递增 */
const FALLBACK_BY_COST = [0, 120, 200, 350, 550, 900]

/** desc 内联的 `a/b/c` 按星级数值 */
function parsePerStar(desc: string): [number, number, number] | null {
	const m = desc.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/)
	if (!m) return null
	return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** desc/@Var@/variables 三源归一为技能规格；S18 数值大多不在数据里，缺省按费用基准 */
export function resolveAbility(apiName: string): AbilitySpec {
	const champ = CHAMPION_BY_API.get(apiName)
	if (!champ) {
		// PvE 野怪等非棋子单位：无技能
		return {
			kind: 'buff',
			name: '野性',
			damageType: 'magic',
			values: [0, 0, 0],
			aoeRange: 0,
			dotSeconds: 0,
			summonCount: 0,
		}
	}
	const { desc, name } = champ.ability
	const arch = ABILITY_ARCHETYPES[apiName]
	const kind: AbilityKind = arch?.kind ?? 'strike'

	const fromVars = (() => {
		for (const v of Object.values(champ.ability.vars)) {
			if (v.length >= 3) return [v[0], v[1], v[2]] as [number, number, number]
		}
		return null
	})()
	const base = FALLBACK_BY_COST[champ.cost] ?? 120
	const values = parsePerStar(desc) ??
		fromVars ?? [base, Math.round(base * 1.8), Math.round(base * 3.24)]

	const damageType = desc.includes('真实伤害')
		? ('true' as const)
		: desc.includes('物理伤害')
			? ('physical' as const)
			: ('magic' as const)

	let aoeRange = 0
	if (kind === 'aoe') {
		aoeRange = desc.includes('所有敌人') || desc.includes('全体敌人') ? 99 : 1
	}

	const summonMatch = desc.match(/(\d+)\s*(?:个|株|名|只)/)
	return {
		kind,
		name,
		damageType,
		values,
		aoeRange,
		dotSeconds: 4,
		summonCount: summonMatch ? Math.min(3, Number(summonMatch[1])) : 1,
	}
}

/** 技能数值结算系数：magic/true 吃 AP（/100），physical 吃 AD（/100） */
export function abilityScale(
	spec: AbilitySpec,
	stats: { abilityPower: number; attackDamage: number },
): number {
	return spec.damageType === 'physical' ? stats.attackDamage / 100 : stats.abilityPower / 100
}
