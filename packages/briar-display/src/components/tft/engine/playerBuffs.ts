import { CHAMPION_BY_API, ITEM_BY_API } from '../data/set18'
// 海克斯团队增益结算：teamBuff + 站位/等级条件加成 + 按已获利息加血 + 携带者系加成
import { AUGMENT_BY_API } from '../data/set18/augments'
import { interestGold } from './economy'
import { isSpatFamily } from './items'
import type { CombatStats, PlayerState, UnitInstance } from './types'

const round2 = (n: number) => Math.round(n * 100) / 100

/** rampBuff 当前层数 = max(初始层数, 已结算回合数)，受上限约束 */
function rampStacks(
	p: PlayerState,
	augApi: string,
	e: { initialStacks?: number; maxStacks?: number },
): number {
	const gained = Number(p.augMemo[`${augApi}.stacks`] ?? 0)
	let stacks = Math.max(e.initialStacks ?? 0, gained)
	if (e.maxStacks !== undefined) stacks = Math.min(stacks, e.maxStacks)
	return stacks
}

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
					if (e.critChance) stats.critChance = round2(stats.critChance + e.critChance)
					if (e.critMult) stats.critMultiplier = round2(stats.critMultiplier + e.critMult)
					if (e.damageAmp) stats.damageAmp = round2(stats.damageAmp + e.damageAmp)
					if (e.damageReduction)
						stats.damageReduction = round2(stats.damageReduction + e.damageReduction)
					if (e.omnivamp) stats.omnivamp = round2(stats.omnivamp + e.omnivamp)
					if (e.manaRegen) stats.manaRegen += e.manaRegen
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
					if (e.ap) stats.abilityPower += e.ap
					if (e.hpFlat) stats.maxHp += e.hpFlat
					if (e.armor) stats.armor += e.armor
					if (e.mr) stats.magicResist += e.mr
					if (e.critChance) stats.critChance = round2(stats.critChance + e.critChance)
					if (e.manaRegen) stats.manaRegen += e.manaRegen
					if (e.damageAmp) stats.damageAmp = round2(stats.damageAmp + e.damageAmp)
					if (e.damageReduction)
						stats.damageReduction = round2(stats.damageReduction + e.damageReduction)
					if (e.omnivamp) stats.omnivamp = round2(stats.omnivamp + e.omnivamp)
					break
				}
				// 条件加成：按单位装备/站位在战斗面板结算（应急护甲/玻璃大炮/浪人/C位的觉悟/双子守护神）
				case 'condBuff': {
					if (!unit) break
					const boardUnit = unit as { pos?: { col: number; row: number } }
					let hit = false
					switch (e.when) {
						case 'noItems':
							hit = unit.items.length === 0
							break
						case 'backRow':
							hit = (boardUnit.pos?.row ?? 0) >= 2
							break
						case 'noNeighborAlly':
							hit = !p.board.some(
								(u) =>
									u.uid !== unit.uid &&
									Math.abs(u.pos.col - (boardUnit.pos?.col ?? 0)) <= 1 &&
									Math.abs(u.pos.row - (boardUnit.pos?.row ?? 0)) <= 1,
							)
							break
						case 'frontRowOnly': {
							const frontCount = p.board.filter((u) => u.pos.row === 0).length
							hit = boardUnit.pos?.row === 0 && frontCount === (e.frontCount ?? 1)
							break
						}
						case 'frontCenter': {
							// 棋盘 4 行 7 列：最前排中心 = row 0 且 col 3
							hit = boardUnit.pos?.row === 0 && boardUnit.pos?.col === 3
							break
						}
					}
					if (!hit) break
					if (e.adPct) stats.attackDamage = Math.round(stats.attackDamage * (1 + e.adPct))
					if (e.apPct) stats.abilityPower = Math.round(stats.abilityPower * (1 + e.apPct))
					if (e.asPct) stats.attackSpeed = round2(stats.attackSpeed * (1 + e.asPct))
					if (e.armor) stats.armor += e.armor
					if (e.mr) stats.magicResist += e.mr
					if (e.hpFlat) stats.maxHp += e.hpFlat
					if (e.hpPct) stats.maxHp = Math.round(stats.maxHp * (1 + e.hpPct))
					if (e.damageAmp) stats.damageAmp = round2(stats.damageAmp + e.damageAmp)
					if (e.damageReduction)
						stats.damageReduction = round2(stats.damageReduction + e.damageReduction)
					if (e.omnivamp) stats.omnivamp = round2(stats.omnivamp + e.omnivamp)
					if (e.critChance) stats.critChance = round2(stats.critChance + e.critChance)
					if (e.shieldPct) stats.startShieldPct = round2((stats.startShieldPct ?? 0) + e.shieldPct)
					break
				}
				// 打气/猛将的荣耀/宝宝学院：按回合数叠加的团队加成（counter 在 augMemo，gameLoop 递增）
				case 'rampBuff': {
					const stacks = rampStacks(p, augApi, e)
					if (stacks <= 0) break
					if (e.asPct) stats.attackSpeed = round2(stats.attackSpeed * (1 + e.asPct * stacks))
					if (e.adPct) stats.attackDamage = Math.round(stats.attackDamage * (1 + e.adPct * stacks))
					if (e.apPct) stats.abilityPower = Math.round(stats.abilityPower * (1 + e.apPct * stacks))
					if (e.hpFlat) stats.maxHp += e.hpFlat * stacks
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
