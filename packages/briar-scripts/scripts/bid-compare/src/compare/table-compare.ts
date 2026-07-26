import type { TableChunk, TablePair } from '../types.ts'

function normalizeCell(cell: string): string {
	return cell.replace(/\s+/g, ' ').trim().toLowerCase()
}

function tableCellSet(rows: string[][]): Set<string> {
	const set = new Set<string>()
	for (const row of rows) {
		for (const cell of row) {
			const normalized = normalizeCell(cell)
			if (normalized) set.add(normalized)
		}
	}
	return set
}

function jaccard(a: Set<string>, b: Set<string>): number {
	if (a.size === 0 && b.size === 0) return 1
	if (a.size === 0 || b.size === 0) return 0
	let common = 0
	for (const item of a) {
		if (b.has(item)) common++
	}
	return common / (a.size + b.size - common)
}

function shapeSimilarity(a: TableChunk, b: TableChunk): number {
	const rowSim = 1 - Math.abs(a.rowCount - b.rowCount) / Math.max(a.rowCount, b.rowCount, 1)
	const colSim = 1 - Math.abs(a.colCount - b.colCount) / Math.max(a.colCount, b.colCount, 1)
	return rowSim * 0.6 + colSim * 0.4
}

function rowSimilarity(rowA: string[], rowB: string[]): number {
	const maxLen = Math.max(rowA.length, rowB.length)
	if (maxLen === 0) return 1
	let matches = 0
	for (let i = 0; i < maxLen; i++) {
		const a = normalizeCell(rowA[i] ?? '')
		const b = normalizeCell(rowB[i] ?? '')
		if (a && a === b) matches++
	}
	return matches / maxLen
}

function computeRowDiff(
	rowsA: string[][],
	rowsB: string[][],
): { index: number; type: 'eq' | 'mod' | 'del' | 'ins'; cellsA: string[]; cellsB: string[] }[] {
	const diff: {
		index: number
		type: 'eq' | 'mod' | 'del' | 'ins'
		cellsA: string[]
		cellsB: string[]
	}[] = []

	let i = 0
	let j = 0
	while (i < rowsA.length || j < rowsB.length) {
		if (i >= rowsA.length) {
			diff.push({ index: j, type: 'ins', cellsA: [], cellsB: rowsB[j] ?? [] })
			j++
			continue
		}
		if (j >= rowsB.length) {
			diff.push({ index: i, type: 'del', cellsA: rowsA[i] ?? [], cellsB: [] })
			i++
			continue
		}

		const sim = rowSimilarity(rowsA[i] ?? [], rowsB[j] ?? [])
		if (sim >= 0.8) {
			diff.push({
				index: i,
				type: sim >= 0.99 ? 'eq' : 'mod',
				cellsA: rowsA[i] ?? [],
				cellsB: rowsB[j] ?? [],
			})
			i++
			j++
		} else {
			// 简单贪心：看下一行是否能匹配，决定当前是删除还是插入
			const nextMatchB =
				j + 1 < rowsB.length ? rowSimilarity(rowsA[i] ?? [], rowsB[j + 1] ?? []) : -1
			const nextMatchA =
				i + 1 < rowsA.length ? rowSimilarity(rowsA[i + 1] ?? [], rowsB[j] ?? []) : -1

			if (nextMatchB > nextMatchA && nextMatchB >= 0.5) {
				diff.push({ index: j, type: 'ins', cellsA: [], cellsB: rowsB[j] ?? [] })
				j++
			} else if (nextMatchA >= 0.5) {
				diff.push({ index: i, type: 'del', cellsA: rowsA[i] ?? [], cellsB: [] })
				i++
			} else {
				// 无法对齐，标记为修改
				diff.push({
					index: i,
					type: 'mod',
					cellsA: rowsA[i] ?? [],
					cellsB: rowsB[j] ?? [],
				})
				i++
				j++
			}
		}
	}

	return diff
}

/**
 * 跨文档表格结构比对
 */
export function compareTables(tables: TableChunk[], threshold = 0.6): TablePair[] {
	const pairs: TablePair[] = []

	for (let i = 0; i < tables.length; i++) {
		for (let j = i + 1; j < tables.length; j++) {
			if (tables[i].doc === tables[j].doc) continue

			const cellSim = jaccard(tableCellSet(tables[i].rows), tableCellSet(tables[j].rows))
			const shapeSim = shapeSimilarity(tables[i], tables[j])
			const sim = Math.round((cellSim * 0.7 + shapeSim * 0.3) * 10000) / 10000

			if (sim < threshold) continue

			pairs.push({
				sim,
				docA: tables[i].doc,
				pageA: tables[i].page,
				docB: tables[j].doc,
				pageB: tables[j].page,
				shapeSim: Math.round(shapeSim * 10000) / 10000,
				cellSim: Math.round(cellSim * 10000) / 10000,
				rowsA: tables[i].rows,
				rowsB: tables[j].rows,
				diffRows: computeRowDiff(tables[i].rows, tables[j].rows),
			})
		}
	}

	pairs.sort((a, b) => b.sim - a.sim)
	return pairs
}
