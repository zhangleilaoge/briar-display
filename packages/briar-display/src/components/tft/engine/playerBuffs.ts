import { CHAMPION_BY_API, ITEM_BY_API } from '../data/set18'
// 海克斯团队增益结算：teamBuff + 站位/等级条件加成 + 按已获利息加血 + 携带者系加成
import { AUGMENT_BY_API } from '../data/set18/augments'
import { interestGold } from './economy'
import { isSpatFamily } from './items'
import type { CombatStats, PlayerState, UnitInstance } from './types'

const round2 = (n: number) => Math.round(n * 100) / 100

/** 战斗面板与属性面板同口径；unit 用于携带者判定（装备系列匹配） */
export function applyPlayerBuffs(
	p: PlayerState,
	stats: CombatStats,
	unit?: UnitInstance,
): CombatStats {
	for (const augApi of p.augments) {
		const def = AUGMENT_BY_API.get(augApi)
		if (!def) continue
		for (const e of def.effects) {
			switch (e.kind) {
				case 'teamBuff': {
					if (e.adPct) stats.attackDamage = Math.round(stats.attackDamage * (1 + e.adPct))
					if (e.ap) stats.abilityPower += e.ap
					if (e.apPct) stats.abilityPower = Math.round(stats.abilityPower * (1 + e.apPct))
					if (e.hpPct) stats.maxHp = Math.round(stats.maxHp * (1 + e.hpPct))
					if (e.hpFlat) stats.maxHp += e.hpFlat
					if (e.asPct) stats.attackSpeed = round2(stats.attackSpeed * (1 + e.asPct))
					if (e.armor) stats.armor += e.armor
					if (e.mr) stats.magicResist += e.mr
					if (e.mana) stats.initialMana += e.mana
					break
				}
				case 'hpPerFrontRow':
					stats.maxHp += e.amount * p.board.filter((u) => u.pos.row === 0).length
					break
				case 'resistsPerFrontRow': {
					const n = p.board.filter((u) => u.pos.row <= 1).length
					stats.armor += e.amount * n
					stats.magicResist += e.amount * n
					break
				}
				case 'resistsPerLevel': {
					const v = e.base + e.perLevel * p.level
					stats.armor += v
					stats.magicResist += v
					break
				}
				// 甜点：队伍按已携带装备数获得生命
				case 'teamHpPerItem': {
					const n = [...p.board, ...p.bench].reduce((sum, u) => sum + (u?.items.length ?? 0), 0)
					stats.maxHp += e.amount * n
					break
				}
				// 灵活摇摆：队伍按已携带纹章数获得生命
				case 'teamHpPerEmblem': {
					const n = [...p.board, ...p.bench].reduce(
						(sum, u) => sum + (u?.items.filter((i) => ITEM_BY_API.get(i)?.grantsTrait).length ?? 0),
						0,
					)
					stats.maxHp += e.amount * n
					break
				}
				// 加冕礼（冠冕系）/厨神阿福（铲锅系）/源计划（1 件装备）/正义报复（指定装备）：携带者获得加成
				case 'holderBuff': {
					if (!unit) break
					const hit = e.item
						? unit.items.includes(e.item)
						: e.itemCount !== undefined
							? unit.items.length === e.itemCount
							: e.match === 'crown'
								? unit.items.some((i) => i.includes('Tactician'))
								: unit.items.some(isSpatFamily)
					if (!hit) break
					if (e.asPct) stats.attackSpeed = round2(stats.attackSpeed * (1 + e.asPct))
					if (e.adPct) stats.attackDamage = Math.round(stats.attackDamage * (1 + e.adPct))
					if (e.apPct) stats.abilityPower = Math.round(stats.abilityPower * (1 + e.apPct))
					if (e.hpFlat) stats.maxHp += e.hpFlat
					if (e.armor) stats.armor += e.armor
					if (e.mr) stats.magicResist += e.mr
					if (e.critChance) stats.critChance = round2(stats.critChance + e.critChance)
					if (e.manaRegen) stats.manaRegen += e.manaRegen
					break
				}
				// 水乳交融：与所持纹章同羁绊的友军获得攻速
				case 'emblemSynergyBuff': {
					const trait = p.augMemo[`${augApi}.trait`]
					if (
						unit &&
						typeof trait === 'string' &&
						CHAMPION_BY_API.get(unit.apiName)?.traits.includes(trait)
					)
						stats.attackSpeed = round2(stats.attackSpeed * (1 + e.asPct))
					break
				}
				default:
					break
			}
		}
	}
	if (p.bonusMaxHpFlat > 0) stats.maxHp += p.bonusMaxHpFlat
	const hpPerInterest = p.augments
		.flatMap((a) => AUGMENT_BY_API.get(a)?.effects ?? [])
		.filter((e) => e.kind === 'teamHpPerInterest')
		.reduce((sum, e) => sum + (e as { amount: number }).amount, 0)
	if (hpPerInterest > 0) stats.maxHp += hpPerInterest * interestGold(p.gold, p)
	return stats
}
