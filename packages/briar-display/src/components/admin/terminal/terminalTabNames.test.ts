import { describe, expect, test } from 'bun:test'
import {
	TERMINAL_TAB_NAMES_KEY,
	readTerminalTabNames,
	writeTerminalTabNames,
} from './terminalTabNames'

function createStorage() {
	const values = new Map<string, string>()
	return {
		values,
		storage: {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => values.set(key, value),
		},
	}
}

describe('终端标签名称', () => {
	test('保存后可恢复，并清理首尾和连续空白', () => {
		const { storage, values } = createStorage()
		expect(writeTerminalTabNames(storage, { '1': '  部署   服务器  ' })).toBe(true)
		expect(readTerminalTabNames(storage)).toEqual({ '1': '部署 服务器' })
		expect(values.has(TERMINAL_TAB_NAMES_KEY)).toBe(true)
	})

	test('忽略损坏数据、非法序号和空名称', () => {
		const { storage, values } = createStorage()
		values.set(TERMINAL_TAB_NAMES_KEY, '{broken')
		expect(readTerminalTabNames(storage)).toEqual({})
		values.set(
			TERMINAL_TAB_NAMES_KEY,
			JSON.stringify({ '1': '有效名称', '2': '   ', tab: '无效序号', '3': 3 }),
		)
		expect(readTerminalTabNames(storage)).toEqual({ '1': '有效名称' })
	})

	test('名称最长保留 24 个字符', () => {
		const { storage } = createStorage()
		writeTerminalTabNames(storage, { '1': '终'.repeat(30) })
		expect(readTerminalTabNames(storage)['1']).toHaveLength(24)
	})

	test('浏览器拒绝写入时返回失败', () => {
		expect(
			writeTerminalTabNames(
				{
					setItem: () => {
						throw new Error('storage unavailable')
					},
				},
				{ '1': '部署' },
			),
		).toBe(false)
	})
})
