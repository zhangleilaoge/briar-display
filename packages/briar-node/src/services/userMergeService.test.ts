import { describe, expect, test } from 'bun:test'
import { validateMerge } from './userMergeService'

describe('validateMerge（合并用户前置校验）', () => {
	test('合法：管理员把别的用户合并到另一个用户', () => {
		expect(
			validateMerge({ sourceId: 'u-gmail', targetId: 'u-qq', currentUserId: 'u-qq' }),
		).toBeNull()
	})
	test('不能合并到自己', () => {
		expect(validateMerge({ sourceId: 'u-1', targetId: 'u-1', currentUserId: 'u-x' })).toBe(
			'MERGE_SAME_USER',
		)
	})
	test('不能把当前登录的自己合并掉', () => {
		expect(validateMerge({ sourceId: 'u-me', targetId: 'u-2', currentUserId: 'u-me' })).toBe(
			'MERGE_SELF_SOURCE',
		)
	})
	test('缺少目标用户', () => {
		expect(validateMerge({ sourceId: 'u-1', targetId: '', currentUserId: 'u-x' })).toBe(
			'MERGE_MISSING_TARGET',
		)
	})
})
