import { describe, expect, test } from 'bun:test'
import { fearGreedHue, fearGreedStyle, fearGreedText } from './fearGreedUi'

describe('恐贪徽章展示', () => {
	test('色相：0 绿 → 100 红，越界截断', () => {
		expect(fearGreedHue(0)).toBe(140)
		expect(fearGreedHue(100)).toBe(0)
		expect(fearGreedHue(50)).toBe(70)
		expect(fearGreedHue(-10)).toBe(140)
		expect(fearGreedHue(130)).toBe(0)
	})

	test('文字：四舍五入 + 档位；缺数据显示 —', () => {
		expect(fearGreedText(62.4)).toEqual({ value: '62', band: 'greed', label: '贪婪' })
		expect(fearGreedText(24.4)).toEqual({ value: '24', band: 'extreme-fear', label: '极度恐惧' })
		expect(fearGreedText(50)).toMatchObject({ label: '中性' })
		expect(fearGreedText(null)).toEqual({ value: '—', band: null, label: '' })
		expect(fearGreedText(Number.NaN).value).toBe('—')
	})

	test('无分数用灰色', () => {
		expect(fearGreedStyle(null).color).toContain('220')
		expect(fearGreedStyle(90).color).toContain('hsl(14 ')
	})
})
