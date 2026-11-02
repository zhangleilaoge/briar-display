import { describe, expect, test } from 'bun:test'
import { readRibbonOrderCache, writeRibbonOrderCache } from './ribbonOrderCache'

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

describe('左侧标签本地顺序缓存', () => {
	test('按用户读写顺序，再次进入页面可直接取得缓存', () => {
		const { storage, values } = createStorage()
		values.set('briar_token', 'token')
		values.set('briar_user', JSON.stringify({ id: 'user-1' }))
		expect(readRibbonOrderCache(storage)).toBeNull()
		expect(writeRibbonOrderCache(storage, 'user-1', ['style', 'home'])).toBe(true)
		expect(readRibbonOrderCache(storage)).toEqual(['style', 'home'])
	})

	test('未登录、切换用户或缓存损坏时不使用旧顺序', () => {
		const { storage, values } = createStorage()
		expect(readRibbonOrderCache(storage)).toBeNull()
		values.set('briar_token', 'token')
		values.set('briar_user', JSON.stringify({ id: 'user-1' }))
		writeRibbonOrderCache(storage, 'user-1', ['style', 'home'])
		values.set('briar_user', JSON.stringify({ id: 'user-2' }))
		expect(readRibbonOrderCache(storage)).toBeNull()
		values.set('briar_user', JSON.stringify({ id: 'user-1' }))
		values.set('briar:ribbon-navigation:user-1', '{broken')
		expect(readRibbonOrderCache(storage)).toBeNull()
	})

	test('缓存沿用标签过滤和至少保留一个的规则', () => {
		const { storage, values } = createStorage()
		values.set('briar_token', 'token')
		values.set('briar_user', JSON.stringify({ id: 'user-1' }))
		values.set('briar:ribbon-navigation:user-1', JSON.stringify(['style', 'unknown', 'style']))
		expect(readRibbonOrderCache(storage)).toEqual(['style'])
		values.set('briar:ribbon-navigation:user-1', '[]')
		expect(readRibbonOrderCache(storage)).toEqual(['home'])
	})
})
