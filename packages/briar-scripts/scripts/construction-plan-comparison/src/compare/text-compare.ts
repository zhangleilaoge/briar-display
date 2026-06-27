import { DEFAULT_CONFIG } from '../config.ts'
import type { TextChunk, TextPair } from '../types.ts'

/**
 * 字符级 N-gram 特征提取
 */
function charNgrams(text: string, n = 3): Map<string, number> {
	const cleaned = text.replace(/[^\u4e00-\u9fff0-9a-zA-Z]/g, '')
	if (cleaned.length < 10) return new Map()

	const counts = new Map<string, number>()
	for (let i = 0; i <= cleaned.length - n; i++) {
		const gram = cleaned.slice(i, i + n)
		counts.set(gram, (counts.get(gram) ?? 0) + 1)
	}
	return counts
}

/**
 * Counter 余弦相似度
 */
function cosineSimCounter(a: Map<string, number>, b: Map<string, number>): number {
	if (a.size === 0 || b.size === 0) return 0

	let dot = 0
	let normA = 0
	let normB = 0

	for (const [k, v] of a) {
		normA += v * v
		const bv = b.get(k)
		if (bv !== undefined) {
			dot += v * bv
		}
	}
	for (const v of b.values()) {
		normB += v * v
	}

	if (normA === 0 || normB === 0) return 0
	return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * 判断是否属于标准化/模板内容
 */
function isStandardizedText(text: string): boolean {
	const t = text.trim()
	if (t.includes('技术标施工组织设计文件') && t.includes('投标项目')) return true
	if (t.startsWith('附表一') && t.includes('附表') && t.includes('拟投入')) return true
	if ((t.match(/\.\./g) ?? []).length > 20) return true
	if (t.includes('投标人应根据招标文件') && t.includes('施工组织设计')) return true
	if (t.startsWith('中铁六局集团有限公司') && t.length < 50) return true
	return false
}

/**
 * 文本跨文档相似度比对
 */
export function compareTexts(
	chunks: TextChunk[],
	threshold = DEFAULT_CONFIG.TEXT_THRESHOLD,
): TextPair[] {
	// 预计算所有 ngram 特征
	const features = chunks.map((c) => charNgrams(c.text))
	const matches: TextPair[] = []
	const seen = new Set<string>()

	for (let i = 0; i < chunks.length; i++) {
		if (i % 200 === 0) {
			process.stdout.write(`\r  text ${i}/${chunks.length} (${matches.length} matches)`)
		}

		for (let j = i + 1; j < chunks.length; j++) {
			// 只比较不同文档
			if (chunks[i].doc === chunks[j].doc) continue

			const sim = cosineSimCounter(features[i], features[j])
			if (sim < threshold) continue

			// 过滤标准化内容
			if (isStandardizedText(chunks[i].text) && isStandardizedText(chunks[j].text)) continue

			const key = `${Math.min(i, j)}-${Math.max(i, j)}`
			if (seen.has(key)) continue
			seen.add(key)

			matches.push({
				sim: Math.round(sim * 10000) / 10000,
				docA: chunks[i].doc,
				pageA: chunks[i].page,
				textA: chunks[i].text,
				docB: chunks[j].doc,
				pageB: chunks[j].page,
				textB: chunks[j].text,
			})
		}
	}

	console.log(`\n  text done: ${matches.length} matches`)
	matches.sort((a, b) => b.sim - a.sim)
	return matches
}
