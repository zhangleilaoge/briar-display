import { describe, expect, test } from 'bun:test'
import {
	buildPaths,
	makeTimeScale,
	nearestIndex,
	priceDomain,
	sessionBreaks,
} from './trendGeometry'

const m = (min: number) => min * 60_000

describe('分时图几何', () => {
	// A股：上午 120 分钟 + 下午 120 分钟
	const sessions: [number, number][] = [
		[m(570), m(690)],
		[m(780), m(900)],
	]

	test('横轴拼接交易时段，午休压缩到同一位置', () => {
		const x = makeTimeScale(sessions)
		expect(x(m(570))).toBe(0)
		expect(x(m(690))).toBe(0.5)
		expect(x(m(720))).toBe(0.5)
		expect(x(m(780))).toBe(0.5)
		expect(x(m(900))).toBe(1)
		expect(x(m(905))).toBe(1)
		expect(x(m(500))).toBe(0)
		expect(sessionBreaks(sessions)).toEqual([0.5])
	})

	test('纵轴以昨收为中心对称，平盘至少 ±0.2%', () => {
		const [lo, hi] = priceDomain(
			[
				[0, 101],
				[1, 99.5],
			],
			100,
		)
		expect((lo + hi) / 2).toBeCloseTo(100)
		expect(hi).toBeCloseTo(101.08)
		const [flo, fhi] = priceDomain([[0, 100]], 100)
		expect(fhi - flo).toBeCloseTo(100 * 0.002 * 2 * 1.08)
	})

	test('路径坐标与最近点查找', () => {
		const x = makeTimeScale(sessions)
		const { line, area, coords } = buildPaths(
			[
				[m(570), 100],
				[m(900), 102],
			],
			x,
			[98, 102],
			1000,
			100,
		)
		expect(coords).toEqual([
			[0, 50],
			[1000, 0],
		])
		expect(line).toBe('M0.00,50.00L1000.00,0.00')
		expect(area.endsWith('L0.00,100Z')).toBe(true)
		expect(nearestIndex([0, 0.3, 0.6, 1], 0.44)).toBe(1)
		expect(nearestIndex([0, 0.3, 0.6, 1], 0.46)).toBe(2)
		expect(nearestIndex([], 0.5)).toBe(-1)
	})
})
