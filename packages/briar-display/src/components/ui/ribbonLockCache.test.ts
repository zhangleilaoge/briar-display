import { describe, expect, test } from 'bun:test'
import { readRibbonLockCache, writeRibbonLockCache } from './ribbonLockCache'

function createStorage() {
	const values = new Map<string, string>()
	return {
		values,
		storage: {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => values.set(key, value),
		},
	}
}

describe('左侧标签固定状态缓存', () => {
	test('默认解锁，按用户读写并覆盖固定状态', () => {
		const { storage, values } = createStorage()
		values.set('briar_token', 'token')
		values.set('briar_user', JSON.stringify({ id: 'user-1' }))
		expect(readRibbonLockCache(storage)).toBeNull()
		expect(writeRibbonLockCache(storage, 'user-1', true)).toBe(true)
		expect(readRibbonLockCache(storage)).toBe(true)
		writeRibbonLockCache(storage, 'user-1', false)
		expect(readRibbonLockCache(storage)).toBe(false)
	})

	test('未登录、切换用户或缓存损坏时不使用旧状态', () => {
		const { storage, values } = createStorage()
		expect(readRibbonLockCache(storage)).toBeNull()
		values.set('briar_token', 'token')
		values.set('briar_user', JSON.stringify({ id: 'user-1' }))
		writeRibbonLockCache(storage, 'user-1', true)
		values.set('briar_user', JSON.stringify({ id: 'user-2' }))
		expect(readRibbonLockCache(storage)).toBeNull()
		values.set('briar_user', JSON.stringify({ id: 'user-1' }))
		values.set('briar:ribbon-locked:user-1', '{broken')
		expect(readRibbonLockCache(storage)).toBeNull()
		values.set('briar:ribbon-locked:user-1', '"true"')
		expect(readRibbonLockCache(storage)).toBeNull()
	})
})
