import { beforeEach, describe, expect, it } from 'bun:test'
import { CHAMPIONS } from '../data/set18'
import { makePlayer } from './testUtils'
import { TRAIT_EFFECTS, applyTraitStats } from './traitEffects'
import { computeActiveTraits } from './traits'
import { createUnit, resetUidSeq, unitStats } from './units'

const slayers = CHAMPIONS.filter((c) => c.traits.includes('DA_18_Slayer'))
const defenders = CHAMPIONS.filter((c) => c.traits.includes('DA_18_Defender'))
const nonDefender = CHAMPIONS.find(
	(c) => !c.traits.includes('DA_18_Defender') && !c.traits.includes('DA_18_Slayer'),
)
if (slayers.length < 2 || defenders.length < 2 || !nonDefender)
	throw new Error('trait fixture 不足')

beforeEach(() => resetUidSeq())

describe('traits', () => {
	it('拷贝计数：两张同名狂战士 = 2 层并激活首档', () => {
		const p = makePlayer()
		p.board.push(
			{ ...createUnit(slayers[0].apiName), pos: { col: 0, row: 0 } },
			{ ...createUnit(slayers[0].apiName), pos: { col: 1, row: 0 } },
		)
		const active = computeActiveTraits(p.board)
		const slayer = active.find((a) => a.apiName === 'DA_18_Slayer')
		expect(slayer?.count).toBe(2)
		expect(slayer?.breakpointIndex).toBe(0)
	})

	it('未达首档不激活', () => {
		const p = makePlayer()
		p.board.push({ ...createUnit(slayers[0].apiName), pos: { col: 0, row: 0 } })
		expect(computeActiveTraits(p.board).find((a) => a.apiName === 'DA_18_Slayer')).toBeUndefined()
	})

	it('trait 域只加成羁绊成员', () => {
		const p = makePlayer()
		p.board.push(
			{ ...createUnit(slayers[0].apiName), pos: { col: 0, row: 0 } },
			{ ...createUnit(slayers[1].apiName), pos: { col: 1, row: 0 } },
		)
		const active = computeActiveTraits(p.board)
		const inTrait = createUnit(slayers[0].apiName)
		const outTrait = createUnit(nonDefender.apiName)
		expect(applyTraitStats(inTrait, unitStats(inTrait), active).omnivamp).toBeGreaterThan(0)
		expect(applyTraitStats(outTrait, unitStats(outTrait), active).omnivamp).toBe(0)
	})

	it('team 域全队加成', () => {
		const p = makePlayer()
		p.board.push(
			{ ...createUnit(defenders[0].apiName), pos: { col: 0, row: 0 } },
			{ ...createUnit(defenders[1].apiName), pos: { col: 1, row: 0 } },
		)
		const active = computeActiveTraits(p.board)
		const outsider = createUnit(nonDefender.apiName)
		const buffed = applyTraitStats(outsider, unitStats(outsider), active)
		expect(buffed.armor).toBe(unitStats(outsider).armor + 15)
		expect(buffed.magicResist).toBe(unitStats(outsider).magicResist + 15)
	})

	it('效果表覆盖全部 36 个羁绊且档位对齐', () => {
		expect(Object.keys(TRAIT_EFFECTS)).toHaveLength(36)
	})
})
