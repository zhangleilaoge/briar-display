import { describe, expect, it } from 'bun:test'
import { applyXp, buyXp, interestGold, playerDamage, roundIncome, streakGold } from './economy'
import { makePlayer } from './testUtils'

describe('economy', () => {
	it('利息：每 10 金 1 点，上限 5', () => {
		expect(interestGold(9)).toBe(0)
		expect(interestGold(10)).toBe(1)
		expect(interestGold(59)).toBe(5)
		expect(interestGold(999)).toBe(5)
	})

	it('连胜连败阶梯：2~3 场 +1，4 场 +2，5+ 场 +3', () => {
		expect(streakGold(1)).toBe(0)
		expect(streakGold(2)).toBe(1)
		expect(streakGold(3)).toBe(1)
		expect(streakGold(4)).toBe(2)
		expect(streakGold(5)).toBe(3)
		expect(streakGold(12)).toBe(3)
	})

	it('回合收入 = 被动+利息+连胜+胜场', () => {
		const p = makePlayer()
		p.gold = 30
		p.streakCount = 5
		const inc = roundIncome(p, 2, 1, true)
		expect(inc).toEqual({ passive: 5, interest: 3, streak: 3, win: 1, bonus: 0, total: 12 })
	})

	it('海克斯：弑君突刺/投资策略II/摇钱树', () => {
		const p = makePlayer()
		p.gold = 60
		p.augments = ['DA_Kingslayer', 'TFT_Augment_InvestmentStrategy2', 'TFT_Augment_MoneyMonsoon']
		const win = roundIncome(p, 2, 2, true)
		expect(win.win).toBe(1)
		expect(win.bonus).toBe(8)
		const loss = roundIncome(p, 2, 3, false)
		expect(loss.win).toBe(0)
		expect(loss.bonus).toBe(7)
		expect(win.interest).toBe(6)
	})

	it('XP 连升并清零溢出', () => {
		const p = makePlayer(1)
		applyXp(p, 10)
		expect(p.level).toBe(4)
		expect(p.xp).toBe(0)
	})

	it('buyXp 扣 4 金得 4 经验；钱不够拒绝', () => {
		const p = makePlayer(5)
		p.gold = 3
		expect(buyXp(p)).toBe(false)
		p.gold = 8
		expect(buyXp(p)).toBe(true)
		expect(p.gold).toBe(4)
	})

	it('战败扣血 = 阶段基础 + 存活数', () => {
		expect(playerDamage(3, 2)).toBe(5)
		expect(playerDamage(7, 5)).toBe(15)
	})
})
