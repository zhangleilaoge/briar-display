import { describe, expect, it } from 'bun:test'
import type { TableChunk } from '../types.ts'
import { compareTables } from './table-compare.ts'

function makeTable(doc: number, page: number, rows: string[][]): TableChunk {
	return {
		doc,
		page,
		rows,
		rowCount: rows.length,
		colCount: rows.length > 0 ? Math.max(...rows.map((r) => r.length)) : 0,
	}
}

describe('compareTables', () => {
	it('相同表格在不同文档间相似度为 1.0', () => {
		const tables = [
			makeTable(0, 1, [
				['型号', '数量'],
				['SCBH15', '2'],
			]),
			makeTable(1, 2, [
				['型号', '数量'],
				['SCBH15', '2'],
			]),
		]
		const pairs = compareTables(tables)
		expect(pairs).toHaveLength(1)
		expect(pairs[0].sim).toBe(1)
	})

	it('形状差异会降低相似度', () => {
		const tables = [
			makeTable(0, 1, [
				['型号', '数量'],
				['SCBH15', '2'],
			]),
			makeTable(1, 2, [
				['型号', '数量'],
				['SCBH15', '2'],
				['备注', '无'],
			]),
		]
		const pairs = compareTables(tables)
		expect(pairs[0].sim).toBeLessThan(1)
		expect(pairs[0].diffRows.some((r) => r.type === 'ins' || r.type === 'del')).toBe(true)
	})

	it('同一文档内的表格不会被比较', () => {
		const tables = [makeTable(0, 1, [['A']]), makeTable(0, 2, [['A']])]
		const pairs = compareTables(tables)
		expect(pairs).toHaveLength(0)
	})

	it('部分单元格修改会被检出', () => {
		const tables = [
			makeTable(0, 1, [
				['型号', '数量'],
				['SCBH15', '2'],
			]),
			makeTable(1, 2, [
				['型号', '数量'],
				['SCBH15', '3'],
			]),
		]
		const pairs = compareTables(tables)
		expect(pairs[0].sim).toBeGreaterThan(0.5)
		expect(pairs[0].diffRows.some((r) => r.type === 'mod')).toBe(true)
	})
})
