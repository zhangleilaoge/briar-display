import { describe, expect, test } from 'bun:test'
import { canManageAccount } from './accountService'

describe('账号状态操作的角色层级限制', () => {
	test('只允许操作严格低于自己的角色', () => {
		expect(
			canManageAccount({ operatorId: 'a', targetId: 'b', operatorLevel: 100, targetLevel: 50 }),
		).toBe(true)
		expect(
			canManageAccount({ operatorId: 'a', targetId: 'b', operatorLevel: 50, targetLevel: 10 }),
		).toBe(true)
		expect(
			canManageAccount({ operatorId: 'a', targetId: 'b', operatorLevel: 50, targetLevel: 0 }),
		).toBe(true)
	})

	test('不能操作自己、同级或更高等级', () => {
		expect(
			canManageAccount({ operatorId: 'a', targetId: 'a', operatorLevel: 100, targetLevel: 10 }),
		).toBe(false)
		expect(
			canManageAccount({ operatorId: 'a', targetId: 'b', operatorLevel: 100, targetLevel: 100 }),
		).toBe(false)
		expect(
			canManageAccount({ operatorId: 'a', targetId: 'b', operatorLevel: 10, targetLevel: 50 }),
		).toBe(false)
		expect(
			canManageAccount({ operatorId: 'a', targetId: 'b', operatorLevel: 0, targetLevel: 0 }),
		).toBe(false)
	})
})
