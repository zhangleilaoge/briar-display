import { describe, expect, test } from 'bun:test'
import {
	normalizeHiddenTools,
	readHiddenToolsCache,
	toggleHiddenTool,
	visibleToolItems,
	writeHiddenToolsCache,
} from './toolsVisibility'

const ALL = ['/a', '/b', '/c']

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

describe('工具箱 tab 显隐', () => {
	test('过滤非法与重复路径，全部隐藏时回退为全部可见', () => {
		expect(normalizeHiddenTools(null, ALL)).toEqual([])
		expect(normalizeHiddenTools(['/b', '/x', '/b', 3], ALL)).toEqual(['/b'])
		expect(normalizeHiddenTools(['/a', '/b', '/c'], ALL)).toEqual([])
	})

	test('切换显隐时至少保留一个可见', () => {
		expect(toggleHiddenTool([], '/a', false, ALL)).toEqual(['/a'])
		expect(toggleHiddenTool(['/a', '/b'], '/c', false, ALL)).toEqual(['/a', '/b'])
		expect(toggleHiddenTool(['/a', '/b'], '/a', true, ALL)).toEqual(['/b'])
	})

	test('顶栏去掉隐藏项但保留当前所在工具', () => {
		const items = ALL.map((href) => ({ href }))
		expect(visibleToolItems(items, ['/a', '/b']).map((i) => i.href)).toEqual(['/c'])
		expect(visibleToolItems(items, ['/a', '/b'], '/a').map((i) => i.href)).toEqual(['/a', '/c'])
	})

	test('按用户读写缓存，未登录不读', () => {
		const { storage, values } = createStorage()
		writeHiddenToolsCache(storage, 'u1', ['/b'])
		expect(readHiddenToolsCache(storage, ALL)).toBeNull()
		values.set('briar_token', 't')
		values.set('briar_user', JSON.stringify({ id: 'u1' }))
		expect(readHiddenToolsCache(storage, ALL)).toEqual(['/b'])
		values.set('briar_user', JSON.stringify({ id: 'u2' }))
		expect(readHiddenToolsCache(storage, ALL)).toBeNull()
	})
})
