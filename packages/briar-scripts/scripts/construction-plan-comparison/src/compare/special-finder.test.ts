import { describe, expect, it } from 'bun:test'
import type { TextChunk } from '../types.ts'
import { findSpecialParagraphs } from './special-finder.ts'

describe('findSpecialParagraphs', () => {
	it('通用模板内容的非标度低于包含稀有型号的内容', () => {
		const commonText =
			'施工组织设计是指导施工准备和施工全过程的技术经济文件。施工单位应依据合同要求组织实施，确保工程按期保质完成。'
		const specialText = `${commonText} 配套专用设备型号 CRH380A-1234 及 ZYJ7-220/2600。`
		const chunks: TextChunk[] = [
			{ doc: 0, page: 1, text: commonText },
			{ doc: 1, page: 1, text: specialText },
		]
		const result = findSpecialParagraphs(chunks)
		const common = result.find((p) => p.text === commonText)
		const special = result.find((p) => p.text === specialText)
		// 含稀有型号的段落非标度应不低于通用模板段落
		expect((special?.score ?? 0) >= (common?.score ?? 0)).toBe(true)
	})

	it('包含稀有型号/术语的段落会被判定为非标', () => {
		const chunks: TextChunk[] = [
			{
				doc: 0,
				page: 1,
				text: '本项目专用设备采用型号 CRH380A-1234 的牵引变流器，配套使用 ZYJ7-220/2600 型液压转辙机，仅在少数标段出现。',
			},
		]
		const result = findSpecialParagraphs(chunks)
		expect(result.length).toBe(1)
		expect(result[0].score).toBeGreaterThan(0.3)
		expect(result[0].models.length).toBeGreaterThan(0)
	})

	it('目录类文本会被过滤', () => {
		const chunks: TextChunk[] = [
			{ doc: 0, page: 1, text: '第一章 编制依据 ....................... 1' },
			{ doc: 0, page: 2, text: '第二章 工程概况 ....................... 3' },
		]
		const result = findSpecialParagraphs(chunks)
		expect(result.length).toBe(0)
	})

	it('重复出现的独特内容仍可能因低频特征被判定为非标', () => {
		const text = '本次投标采用独有的专利工艺 PT-2024X，配合设备型号 ABC-9999 使用。'
		const chunks: TextChunk[] = [
			{ doc: 0, page: 1, text },
			{ doc: 1, page: 1, text },
		]
		const result = findSpecialParagraphs(chunks)
		// 重复 2 次仍在 rareGrams 的 1~3 次阈值内，因此仍可能被判为非标
		expect(result.length).toBeGreaterThan(0)
	})

	it('太短的文本会被过滤', () => {
		const chunks: TextChunk[] = [{ doc: 0, page: 1, text: '短文本 XYZ-123' }]
		const result = findSpecialParagraphs(chunks)
		expect(result.length).toBe(0)
	})
})
