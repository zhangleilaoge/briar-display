import { describe, expect, it } from 'bun:test'
import type { TextChunk } from '../types.ts'
import { compareTexts } from './text-compare.ts'

describe('compareTexts', () => {
	it('相同文本在不同文档间相似度为 1.0', () => {
		const text = '本工程采用钢筋混凝土结构，施工时应严格按照设计图纸进行操作。'
		const chunks: TextChunk[] = [
			{ doc: 0, page: 1, text },
			{ doc: 1, page: 2, text },
		]
		const result = compareTexts(chunks, 0.5)
		expect(result).toHaveLength(1)
		expect(result[0].sim).toBe(1)
	})

	it('完全不同文本相似度接近 0', () => {
		const chunks: TextChunk[] = [
			{ doc: 0, page: 1, text: '一二三四五六七八九十abcdefghijklmnopqrstuvwxyz' },
			{ doc: 1, page: 1, text: '甲乙丙丁戊己庚辛壬癸zyxwvutsrqponmlkjihgfedcba' },
		]
		const result = compareTexts(chunks, 0.1)
		expect(result).toHaveLength(0)
	})

	it('同一文档内的文本块不会被比较', () => {
		const chunks: TextChunk[] = [
			{ doc: 0, page: 1, text: '这是一段完全相同的文本内容，用于测试同文档过滤。' },
			{ doc: 0, page: 2, text: '这是一段完全相同的文本内容，用于测试同文档过滤。' },
		]
		const result = compareTexts(chunks, 0.5)
		expect(result).toHaveLength(0)
	})

	it('部分相似文本会被正确检出', () => {
		const chunks: TextChunk[] = [
			{
				doc: 0,
				page: 1,
				text: '施工组织设计方案编制依据包括招标文件、施工图纸、国家规范及相关标准。',
			},
			{
				doc: 1,
				page: 1,
				text: '施工组织设计方案编制依据包括招标文件、施工图纸、国家规范及相关标准，并参考现场实际情况。',
			},
		]
		const result = compareTexts(chunks, 0.5)
		expect(result.length).toBeGreaterThan(0)
		expect(result[0].sim).toBeGreaterThan(0.5)
	})
})
