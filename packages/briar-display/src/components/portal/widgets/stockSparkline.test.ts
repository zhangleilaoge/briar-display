import { describe, expect, test } from 'bun:test'
import { sparklineGeometry } from './stockSparkline'

describe('股票火花线昨收零轴', () => {
	test('曲线全在昨收上方时，零轴保留在底部', () => {
		expect(sparklineGeometry([101, 102], 100)).toEqual({
			points: '2.00,18.00 98.00,2.00',
			baselineY: 34,
		})
	})

	test('曲线全在昨收下方时，零轴保留在顶部', () => {
		expect(sparklineGeometry([98, 99], 100)).toEqual({
			points: '2.00,34.00 98.00,18.00',
			baselineY: 2,
		})
	})

	test('没有有效昨收或数据不足时不画零轴', () => {
		expect(sparklineGeometry([98, 99], Number.NaN).baselineY).toBeNull()
		expect(sparklineGeometry([99], 100)).toEqual({ points: '', baselineY: null })
	})
})
