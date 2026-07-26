import { describe, expect, it } from 'bun:test'
import { extractKeywords, keywordOverlapScore } from './keyword-utils.ts'

describe('extractKeywords', () => {
	it('能提取型号编号', () => {
		const text = '本项目采用 CRH380A-1234 牵引变流器及 ZYJ7-220/2600 型设备。'
		const kws = extractKeywords(text)
		expect(kws).toContain('CRH380A-1234')
		expect(kws).toContain('ZYJ7-220/2600')
	})

	it('能提取工程规格', () => {
		const text = '混凝土强度等级 C30，钢筋直径 Φ8，砂浆 M15，厚度 300mm。'
		const kws = extractKeywords(text)
		expect(kws).toContain('C30')
		expect(kws).toContain('Φ8')
		expect(kws).toContain('M15')
		expect(kws).toContain('300mm')
	})
})

describe('keywordOverlapScore', () => {
	it('相同关键词返回 1', () => {
		const text = '混凝土 C30 钢筋 Φ8'
		expect(keywordOverlapScore(text, text)).toBe(1)
	})

	it('无共同关键词返回 0', () => {
		const a = '混凝土 C30 钢筋 Φ8'
		const b = '屋面防水 SBS 卷材 XPS 保温板'
		expect(keywordOverlapScore(a, b)).toBe(0)
	})

	it('部分重叠返回正确比例', () => {
		const a = '混凝土 C30 钢筋 Φ8 砂浆 M15'
		const b = '混凝土 C30 钢筋 Φ10'
		const score = keywordOverlapScore(a, b)
		expect(score).toBeGreaterThan(0)
		expect(score).toBeLessThanOrEqual(1)
	})
})
