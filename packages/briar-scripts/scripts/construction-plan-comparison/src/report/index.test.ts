import { describe, expect, it } from 'bun:test'
import type { CompareResult } from '../types.ts'
import { generateHtmlReport } from './index.ts'

function runReportScript(html: string) {
	const match = html.match(/<script>([\s\S]*?)<\/script>/)
	if (!match) throw new Error('script not found')
	const script = match[1]

	const containers: Record<string, { innerHTML: string; value: string; checked: boolean }> = {}
	const getEl = (id: string) => {
		if (!containers[id]) {
			containers[id] = { innerHTML: '', value: 'all', checked: true }
		}
		return containers[id]
	}
	const nodeList = (arr: unknown[]) => ({ forEach: (cb: (v: unknown) => void) => arr.forEach(cb) })

	const doc = {
		getElementById: getEl,
		querySelector: () => null,
		querySelectorAll: () => nodeList([]),
		addEventListener: () => {},
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	;(globalThis as any).document = doc

	new Function(script)()
	return containers
}

describe('generateHtmlReport', () => {
	it('生成的 HTML 脚本能在浏览器环境中正常渲染各面板', () => {
		const result: CompareResult = {
			config: { chunkSize: 300, imgThreshold: 0.7, textThreshold: 0.5, tableThreshold: 0.6 },
			docNames: ['a.pdf', 'b.pdf'],
			allChunks: [
				{ id: 'doc0_p1_i0', doc: 0, page: 1, text: '第一章 施工组织设计' },
				{ id: 'doc1_p1_i0', doc: 1, page: 1, text: '第一章 施工组织设计' },
			],
			allTables: [
				{ doc: 0, page: 2, rows: [['A', 'B']], rowCount: 1, colCount: 2 },
				{ doc: 1, page: 2, rows: [['A', 'C']], rowCount: 1, colCount: 2 },
			],
			imgPairs: [
				{
					sim: 1,
					docA: 0,
					pageA: 1,
					docB: 1,
					pageB: 1,
					wA: 100,
					hA: 100,
					wB: 100,
					hB: 100,
					imgPathA: 'images/a.jpg',
					imgPathB: 'images/b.jpg',
				},
			],
			imgGroups: [
				{
					id: 0,
					size: 2,
					docs: [0, 1],
					repSim: 1,
					repA: {
						doc: 0,
						page: 1,
						idx: 1,
						width: 100,
						height: 100,
						imgPath: 'images/a.jpg',
					},
					repB: {
						doc: 1,
						page: 1,
						idx: 1,
						width: 100,
						height: 100,
						imgPath: 'images/b.jpg',
					},
					itemsByDoc: [
						{
							doc: 0,
							items: [
								{
									doc: 0,
									page: 1,
									idx: 1,
									width: 100,
									height: 100,
									imgPath: 'images/a.jpg',
								},
							],
						},
						{
							doc: 1,
							items: [
								{
									doc: 1,
									page: 1,
									idx: 1,
									width: 100,
									height: 100,
									imgPath: 'images/b.jpg',
								},
							],
						},
					],
				},
			],
			textPairs: [
				{
					sim: 0.95,
					docA: 0,
					pageA: 1,
					chunkAId: 'doc0_p1_i0',
					docB: 1,
					pageB: 1,
					chunkBId: 'doc1_p1_i0',
				},
			],
			tablePairs: [
				{
					sim: 0.85,
					docA: 0,
					pageA: 2,
					docB: 1,
					pageB: 2,
					shapeSim: 1,
					cellSim: 0.85,
					rowsA: [['A', 'B']],
					rowsB: [['A', 'C']],
					diffRows: [{ index: 0, type: 'mod', cellsA: ['A', 'B'], cellsB: ['A', 'C'] }],
				},
			],
			specialParas: [
				{
					doc: 0,
					page: 1,
					chunkId: 'doc0_p1_i0',
					score: 0.6,
					models: [],
					rareGrams: ['施工组织'],
				},
			],
		}

		const html = generateHtmlReport(result, 500)
		expect(html).toContain('图片比对结果')
		expect(html).toContain('表格结构比对')

		const c = runReportScript(html)
		expect(c.imgGroupsContainer.innerHTML.length).toBeGreaterThan(0)
		expect(c.tablePairsContainer.innerHTML.length).toBeGreaterThan(0)
		expect(c.textPairsContainer.innerHTML.length).toBeGreaterThan(0)
		expect(c.spAllContainer.innerHTML.length).toBeGreaterThan(0)
	})
})
