import fs from 'node:fs'
import path from 'node:path'
import type { CompareResult } from '../types.ts'

function csvEscape(value: string | number): string {
	const str = String(value).replace(/\r?\n/g, ' ')
	if (str.includes(',') || str.includes('"') || str.includes('\n')) {
		return `"${str.replace(/"/g, '""')}"`
	}
	return str
}

function writeCsv(filePath: string, headers: string[], rows: (string | number)[][]): void {
	const lines = [headers.join(','), ...rows.map((row) => row.map(csvEscape).join(','))]
	fs.writeFileSync(filePath, `\ufeff${lines.join('\n')}`, 'utf-8')
}

export function exportTextPairs(outDir: string, result: CompareResult): string {
	const chunkMap = new Map(result.allChunks.map((c) => [c.id, c.text]))
	const filePath = path.join(outDir, 'text_pairs.csv')
	const headers = ['相似度', '文档A', '页码A', '文档B', '页码B', '文本A', '文本B']
	const rows = result.textPairs.map((p) => [
		p.sim,
		`文档${p.docA + 1}`,
		p.pageA,
		`文档${p.docB + 1}`,
		p.pageB,
		chunkMap.get(p.chunkAId) ?? '',
		chunkMap.get(p.chunkBId) ?? '',
	])
	writeCsv(filePath, headers, rows)
	return filePath
}

export function exportSpecialParagraphs(outDir: string, result: CompareResult): string {
	const chunkMap = new Map(result.allChunks.map((c) => [c.id, c.text]))
	const filePath = path.join(outDir, 'special_paragraphs.csv')
	const headers = ['非标得分', '文档', '页码', '型号/关键词', '文本']
	const rows = result.specialParas.map((p) => [
		p.score,
		`文档${p.doc + 1}`,
		p.page,
		p.models.join('; '),
		chunkMap.get(p.chunkId) ?? '',
	])
	writeCsv(filePath, headers, rows)
	return filePath
}

export function exportImagePairs(outDir: string, result: CompareResult): string {
	const filePath = path.join(outDir, 'image_pairs.csv')
	const headers = [
		'相似度',
		'文档A',
		'页码A',
		'文档B',
		'页码B',
		'尺寸A',
		'尺寸B',
		'图片A路径',
		'图片B路径',
	]
	const rows = result.imgPairs.map((p) => [
		p.sim,
		`文档${p.docA + 1}`,
		p.pageA,
		`文档${p.docB + 1}`,
		p.pageB,
		`${p.wA}x${p.hA}`,
		`${p.wB}x${p.hB}`,
		p.imgPathA,
		p.imgPathB,
	])
	writeCsv(filePath, headers, rows)
	return filePath
}

export function exportTablePairs(outDir: string, result: CompareResult): string {
	const filePath = path.join(outDir, 'table_pairs.csv')
	const headers = [
		'相似度',
		'形状相似度',
		'单元格相似度',
		'文档A',
		'页码A',
		'文档B',
		'页码B',
		'差异行数',
		'表格A行数',
		'表格B行数',
	]
	const rows = result.tablePairs.map((p) => [
		p.sim,
		p.shapeSim,
		p.cellSim,
		`文档${p.docA + 1}`,
		p.pageA,
		`文档${p.docB + 1}`,
		p.pageB,
		p.diffRows.filter((r) => r.type !== 'eq').length,
		p.rowsA.length,
		p.rowsB.length,
	])
	writeCsv(filePath, headers, rows)
	return filePath
}

export function exportAll(
	outDir: string,
	result: CompareResult,
): { textPairs: string; specialParas: string; imgPairs: string; tablePairs: string } {
	return {
		textPairs: exportTextPairs(outDir, result),
		specialParas: exportSpecialParagraphs(outDir, result),
		imgPairs: exportImagePairs(outDir, result),
		tablePairs: exportTablePairs(outDir, result),
	}
}
