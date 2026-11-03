import { describe, expect, test } from 'bun:test'
import {
	extractThoughtTags,
	normalizeThoughtTag,
	parseThoughtTagList,
	splitTagText,
} from '@briar/shared'

describe('想法 #标签 解析', () => {
	test('中英数字与下划线', () => {
		expect(extractThoughtTags('今天 #读书 #Book_2026 打卡')).toEqual(['读书', 'book_2026'])
	})
	test('遇标点/空白截止', () => {
		expect(extractThoughtTags('#周末，去爬山。#旅行! (#摄影) 「#电影」')).toEqual([
			'周末',
			'旅行',
			'摄影',
			'电影',
		])
	})
	test('URL 内的 #fragment 不算标签', () => {
		expect(
			extractThoughtTags('看 https://example.com/a#section 和 https://x.cn/#/home #真的'),
		).toEqual(['真的'])
	})
	test('紧跟字母数字的 # 不算（a#b、C#、&#123）', () => {
		expect(extractThoughtTags('a#b C# &#123; ##双井')).toEqual([])
	})
	test('去重 + 大小写规范化', () => {
		expect(extractThoughtTags('#Foo #foo #FOO')).toEqual(['foo'])
		expect(normalizeThoughtTag('##Hello')).toBe('hello')
	})
	test('超长不截断成标签', () => {
		expect(extractThoughtTags(`#${'a'.repeat(33)}`)).toEqual([])
	})
	test('splitTagText 保留原文', () => {
		const parts = splitTagText('hi #标签，ok')
		expect(parts).toEqual([
			{ type: 'text', value: 'hi ' },
			{ type: 'tag', tag: '标签', value: '#标签' },
			{ type: 'text', value: '，ok' },
		])
	})
})

describe('多标签筛选参数解析', () => {
	test('重复参数 + 逗号分隔 + 兼容单个', () => {
		expect(parseThoughtTagList(['读书'])).toEqual(['读书'])
		expect(parseThoughtTagList(['读书', 'Book'])).toEqual(['读书', 'book'])
		expect(parseThoughtTagList('a,b，c')).toEqual(['a', 'b', 'c'])
	})
	test('去空、去 #、去重', () => {
		expect(parseThoughtTagList(['#A', 'a', '', ' , ', null, undefined, 'b'])).toEqual(['a', 'b'])
		expect(parseThoughtTagList(null)).toEqual([])
	})
	test('最多 10 个', () => {
		expect(parseThoughtTagList(Array.from({ length: 20 }, (_, i) => `t${i}`))).toHaveLength(10)
	})
})
