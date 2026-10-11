import { describe, expect, test } from 'bun:test'
import { generateABogus } from './aBogus'

const UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

/** 与 Python golden 生成端共享的 LCG（逐 draw 对齐；乘积超 2^53，必须走 BigInt） */
const lcg = (seed: number) => {
	let x = BigInt(seed)
	return () => {
		x = (x * 1103515245n + 12345n) % 2147483648n
		return Number(x) / 2147483648
	}
}

describe('generateABogus (bdms.js v1.0.1.19)', () => {
	// 黄金回归：与 Evil0ctal dtk/signing/native/abogus.py 逐字节对齐（同随机序列下同输出）。
	// 若抖音升级 SDK 导致线上签名失效需调整算法，同步更新此 golden
	test('固定时间戳与随机源的输出回归', () => {
		expect(
			generateABogus(
				'aweme_id=7695224041367522560&device_platform=webapp&aid=6383&channel=channel_pc_web',
				UA,
				{ nowMs: 1791714000000, rand: lcg(42) },
			),
		).toBe(
			'xj0fgqyJYZmfedFGYcj8SccU5CylrPSyKTiQbSCPSxK0yXtToYNvsOG5nxqh4ZEhyRphweV7DDllbdxcqUU0pKrkLmpDSDhWI05IIg8o2qqRTFvQLrb0eu6FLwMnUbGqeA54i1U6/UJ9gVVAiqdg/Q5yCKoe5bWBFpOykZzci9s6ZM6AgpcaPpbkT7Na0A/7',
		)
		expect(
			generateABogus('aweme_id=7521000000000000000&device_platform=webapp&aid=6383', UA, {
				nowMs: 1758000000000,
				rand: lcg(7),
			}),
		).toBe(
			'dysnkeXjOZWcadFGuCjuS9NlnHn/rBuyMGT/b9MPyPPTc7tGVbNGLxCIGxzg4MYsKuBiieVHmDU/bddcssUzZFnkFmkvSmhWYz59Vgfo2qwmGFJQDrjiew6zqw0N05Gqe/5viA4I2UJH6nnAiNQ8/Q-9SKLFQ5WBMZxSkZYcN9B6ZzLAE3crPBtkqhRl',
		)
	})

	test('默认参数（真实时间戳与随机源）输出格式', () => {
		const sig = generateABogus('aid=6383', UA)
		// s4 自定义 base64 字符集（含 - 和 /，无 +）
		expect(sig).toMatch(/^[A-Za-z0-9/_-]+={0,2}$/)
	})
})
