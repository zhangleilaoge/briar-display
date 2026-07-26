import { spawn } from 'node:child_process'
import path from 'node:path'
import { DEFAULT_CONFIG } from '../config.ts'
import { PythonEnvError, assertPythonPath, enhancePythonError } from '../python-env.ts'
import type { TableChunk, TextChunk } from '../types.ts'

const ENCODER_DIR = path.join(import.meta.dir, '..', '..', 'python_encoder')
const EXTRACTOR_PATH = path.join(ENCODER_DIR, 'text_extractor.py')

function extractViaPython(
	pdfPath: string,
	docIdx: number,
	chunkSize: number,
	chunkOverlap: number,
): Promise<{
	chunks: { page: number; type: 'text' | 'table'; text: string }[]
	tables: { page: number; rows: string[][] }[]
	error?: string
	warning?: string
}> {
	return new Promise((resolve, reject) => {
		let pythonPath: string
		try {
			pythonPath = assertPythonPath()
		} catch (err) {
			reject(err)
			return
		}

		const proc = spawn(pythonPath, [EXTRACTOR_PATH], {
			stdio: ['pipe', 'pipe', 'pipe'],
		})

		let stdout = ''
		let stderr = ''

		proc.stdout.on('data', (data: Buffer) => {
			stdout += data.toString()
		})
		proc.stderr.on('data', (data: Buffer) => {
			stderr += data.toString()
		})
		proc.on('close', (code) => {
			if (code !== 0) {
				reject(
					new PythonEnvError(
						`Python text extractor failed (exit ${code}): ${enhancePythonError(stderr)}`,
					),
				)
				return
			}
			// 某些库会往 stdout 打印警告，取最后一行 JSON 解析
			const lastJsonLine = stdout
				.split('\n')
				.reverse()
				.find((line) => line.trim().startsWith('{'))
			if (!lastJsonLine) {
				reject(new Error('No JSON output found from Python text extractor'))
				return
			}
			try {
				const result = JSON.parse(lastJsonLine) as {
					chunks: { page: number; type: 'text' | 'table'; text: string }[]
					tables: { page: number; rows: string[][] }[]
					error?: string
					warning?: string
				}
				resolve({
					chunks: result.chunks ?? [],
					tables: result.tables ?? [],
					error: result.error,
					warning: result.warning,
				})
			} catch (e) {
				reject(new Error(`Failed to parse Python extractor output: ${e}`))
			}
		})
		proc.on('error', reject)

		proc.stdin.write(
			JSON.stringify({
				pdf_path: pdfPath,
				doc_idx: docIdx,
				chunk_size: chunkSize,
				chunk_overlap: chunkOverlap,
			}),
		)
		proc.stdin.end()
	})
}

/**
 * 从 PDF 提取文本与表格
 * 使用 Python PyMuPDF 子进程，支持中文与表格结构
 */
export async function extractTextAndTables(
	pdfPath: string,
	docIdx: number,
	chunkSize = DEFAULT_CONFIG.CHUNK_SIZE,
	overlap = DEFAULT_CONFIG.CHUNK_OVERLAP,
): Promise<{ chunks: TextChunk[]; tables: TableChunk[]; warning?: string }> {
	const { chunks, tables, error, warning } = await extractViaPython(
		pdfPath,
		docIdx,
		chunkSize,
		overlap,
	)
	if (error) {
		throw new Error(error)
	}
	return {
		chunks: chunks.map((c, i) => ({
			id: `doc${docIdx}_p${c.page}_i${i}`,
			doc: docIdx,
			page: c.page,
			text: c.type === 'table' ? `[表格]\n${c.text}` : c.text,
		})),
		tables: tables.map((t) => {
			const rows = t.rows.filter((r) => r.some((cell) => cell.trim()))
			return {
				doc: docIdx,
				page: t.page,
				rows,
				rowCount: rows.length,
				colCount: rows.length > 0 ? Math.max(...rows.map((r) => r.length)) : 0,
			}
		}),
		...(warning ? { warning } : {}),
	}
}
