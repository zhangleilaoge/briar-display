import { describe, expect, test } from 'bun:test'
import { createSnapshot } from './csi300EtfScale'
import { type Csi300EtfSyncDependencies, syncCsi300EtfScale } from './csi300EtfService'

const NOW = Date.UTC(2026, 10, 2)
const index = {
	date: '2026-10-09',
	indexClose: 4500,
	floatMarketCap: 50_000_000_000_000,
}
const snapshot = createSnapshot(
	index,
	Object.fromEntries(['510300', '510330', '159919', '510310'].map((code) => [code, 1_000_000])),
	{
		'510300': { date: index.date, unitNav: 4 },
		'510330': { date: index.date, unitNav: 3 },
		'159919': { date: index.date, unitNav: 2 },
		'510310': { date: index.date, unitNav: 1 },
	},
)

function dependencies(
	overrides: Partial<Csi300EtfSyncDependencies> = {},
): Csi300EtfSyncDependencies {
	return {
		now: () => NOW,
		fetchIndexMonth: async () => [index],
		fetchMonth: async () => [snapshot],
		list: async () => [],
		upsert: async () => {},
		...overrides,
	}
}

describe('头部沪深300ETF占比：增量同步', () => {
	test('官方完整月报未发布时跳过，不访问数据库或回填', async () => {
		const result = await syncCsi300EtfScale(
			dependencies({
				fetchIndexMonth: async () => [],
				list: async () => {
					throw new Error('不应读取数据库')
				},
				fetchMonth: async () => {
					throw new Error('不应回填')
				},
			}),
		)
		expect(result).toMatchObject({ status: 'skipped', detail: { month: '202610', snapshots: 0 } })
	})

	test('月份完整时幂等 upsert 原始快照', async () => {
		let saved: unknown
		const result = await syncCsi300EtfScale(
			dependencies({
				upsert: async (snapshots) => {
					saved = snapshots
				},
			}),
		)
		expect(saved).toEqual([snapshot])
		expect(result).toMatchObject({ detail: { month: '202610', snapshots: 1, asOf: index.date } })
	})

	test('基金日期与指数不完整时不写入任何快照', async () => {
		let writes = 0
		await expect(
			syncCsi300EtfScale(
				dependencies({
					fetchMonth: async () => [],
					upsert: async () => {
						writes++
					},
				}),
			),
		).rejects.toThrow('未写入数据库')
		expect(writes).toBe(0)
	})

	test('内置种子已覆盖时跳过重复回填', async () => {
		const result = await syncCsi300EtfScale(
			dependencies({
				now: () => Date.UTC(2026, 9, 27),
				fetchIndexMonth: async () => [{ ...index, date: '2026-09-30' }],
				fetchMonth: async () => {
					throw new Error('不应重复回填')
				},
			}),
		)
		expect(result).toMatchObject({ status: 'skipped', detail: { month: '202609', snapshots: 0 } })
	})
})
