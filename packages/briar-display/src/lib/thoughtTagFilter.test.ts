import { describe, expect, test } from 'bun:test'
import { formatTagList, toggleTagInList } from './thoughtTagFilter'

describe('想法多标签筛选', () => {
	test('点未选中的追加，点已选中的移除', () => {
		expect(toggleTagInList([], 'a')).toEqual(['a'])
		expect(toggleTagInList(['a'], 'b')).toEqual(['a', 'b'])
		expect(toggleTagInList(['a', 'b'], 'a')).toEqual(['b'])
	})
	test('格式化标签列表', () => {
		expect(formatTagList(['读书'])).toBe('#读书')
		expect(formatTagList(['读书', '电影'])).toBe('#读书、#电影')
		expect(formatTagList(['a', 'b'], ' 或 ')).toBe('#a 或 #b')
	})
})
