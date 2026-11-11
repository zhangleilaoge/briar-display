import { describe, expect, test } from 'bun:test'
import { thoughtVisibilityCondition } from './thoughtVisibility'

describe('想法可见范围', () => {
	test('访客只能读取公开想法', () => {
		expect(thoughtVisibilityCondition()).toEqual({ sql: ' AND t.is_private = 0', params: [] })
		expect(thoughtVisibilityCondition(null)).toEqual({
			sql: ' AND t.is_private = 0',
			params: [],
		})
	})

	test('登录用户可读取公开想法和自己的私密想法', () => {
		expect(thoughtVisibilityCondition('user-1')).toEqual({
			sql: ' AND (t.is_private = 0 OR t.user_id = ?)',
			params: ['user-1'],
		})
	})

	test('标签统计使用相同的作者隔离规则', () => {
		expect(thoughtVisibilityCondition('user-2', 'thought')).toEqual({
			sql: ' AND (thought.is_private = 0 OR thought.user_id = ?)',
			params: ['user-2'],
		})
	})
})
