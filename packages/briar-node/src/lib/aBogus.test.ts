import { describe, expect, test } from 'bun:test'
import { generateABogus } from './aBogus'

const QUERY = 'aweme_id=7521000000000000000&device_platform=webapp&aid=6383'
const FIXED_OPTIONS = {
	startTime: 1758000000000,
	endTime: 1758000000004,
	randoms: [1234, 5678, 9012] as [number, number, number],
}

describe('generateABogus', () => {
	// 黄金回归：与 Evil0ctal abogus.py 逐字节对齐的实现，任何算法改动都会让输出变化。
	// 若抖音升级 SDK 导致线上签名失效需调整算法，同步更新此 golden
	test('固定时间戳与随机源的输出回归', () => {
		expect(generateABogus(QUERY, FIXED_OPTIONS)).toBe(
			'E7mhBdugDifihdWk5UVLfY3q6I6VYmQg0SVkMD2fp-DO9L39HMYg9exoJcJvgY8ji4/sIeEjy4hbT3ohrQ2y0Hwf9W0L/25ksDSkKl5Q5xSSs1X9eghgJ04qmkt5SMx2RvB-rOXmqhZHKRbp09oHmhK4b1dzFgf3qJLz4D==',
		)
	})

	test('默认参数（真实时间戳与随机源）输出格式', () => {
		const sig = generateABogus(QUERY)
		// 自定义 base64 字符集（BASE64_S4：含 - 和 /，无 +）
		expect(sig).toMatch(/^[A-Za-z0-9/_-]+={0,2}$/)
		expect(sig.length).toBe(168)
	})
})
