import { describe, expect, test } from 'bun:test'
import { sm3OfString } from './sm3'

const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')

// OpenSSL 测试向量（国密 SM3 标准附录示例）
describe('sm3', () => {
	test('SM3("abc")', () => {
		expect(hex(sm3OfString('abc'))).toBe(
			'66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0',
		)
	})

	test('SM3("abcd"×16)（64 字节，跨分组压缩）', () => {
		expect(hex(sm3OfString('abcd'.repeat(16)))).toBe(
			'debe9ff92275b8a138604889c18e5a4d6fdb70e5387e5765293dcba39c0c5732',
		)
	})
})
