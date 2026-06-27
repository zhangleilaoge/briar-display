import fs from 'node:fs'
import { createRequire } from 'node:module'
import { DEFAULT_CONFIG } from '../config.ts'
import type { TextChunk } from '../types.ts'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse') as (
	buffer: Buffer,
) => Promise<{ text: string; numpages: number }>

/**
 * 在 [searchStart, searchEnd) 范围内查找最后一个分隔符位置
 */
function rfindInRange(text: string, sep: string, searchStart: number, searchEnd: number): number {
	const substr = text.slice(searchStart, searchEnd)
	const pos = substr.lastIndexOf(sep)
	if (pos === -1) return -1
	return searchStart + pos
}

/**
 * 固定长度拆分文本（移植自 Python 版本）
 */
export function splitFixed(
	text: string,
	chunkSize = DEFAULT_CONFIG.CHUNK_SIZE,
	overlap = DEFAULT_CONFIG.CHUNK_OVERLAP,
): string[] {
	const rawParas = text.split(/\n{2,}/)
	const chunks: string[] = []

	for (const para of rawParas) {
		const cleaned = para.replace(/\s+/g, ' ').trim()
		if (cleaned.length < 20) continue

		if (cleaned.length <= chunkSize) {
			chunks.push(cleaned)
		} else {
			let start = 0
			while (start < cleaned.length) {
				let end = Math.min(start + chunkSize, cleaned.length)

				if (end < cleaned.length) {
					// 在 chunk 的后半段查找句子边界
					const searchStart = start + Math.floor(chunkSize / 2)
					const seps = ['。', '；', '！', '？', '. ', '; ', '! ', '? ', '，', ', ']
					for (const sep of seps) {
						const pos = rfindInRange(cleaned, sep, searchStart, end)
						if (pos >= searchStart) {
							end = pos + sep.length
							break
						}
					}
				}

				const chunk = cleaned.slice(start, end).trim()
				if (chunk.length >= 20) {
					chunks.push(chunk)
				}

				const nextStart = end - overlap
				if (nextStart <= start) {
					// 防止死循环，强制前进
					start = end
				} else {
					start = nextStart
				}
				if (start >= cleaned.length) break
			}
		}
	}
	return chunks
}

/**
 * 从 PDF 提取文本（使用 pdf-parse）
 */
export async function extractTexts(
	pdfPath: string,
	docIdx: number,
	chunkSize?: number,
	overlap?: number,
): Promise<TextChunk[]> {
	const buffer = fs.readFileSync(pdfPath)
	const data = await pdfParse(buffer)

	const chunks: TextChunk[] = []
	const textChunks = splitFixed(data.text, chunkSize, overlap)
	for (const text of textChunks) {
		chunks.push({ doc: docIdx, page: 0, text })
	}
	return chunks
}
