import { describe, expect, test } from 'bun:test'
import { publishPreference, subscribePreference } from './preferenceBus'

describe('偏好内存广播', () => {
	test('按 key 分发并带来源，退订后不再收到', () => {
		const a = Symbol('a')
		const received: [unknown, symbol][] = []
		const off = subscribePreference('k1', (value, source) => received.push([value, source]))
		subscribePreference('k2', () => {
			throw new Error('不应收到其它 key')
		})
		publishPreference('k1', [1, 2], a)
		expect(received).toEqual([[[1, 2], a]])
		off()
		publishPreference('k1', [3], a)
		expect(received).toHaveLength(1)
	})
})
