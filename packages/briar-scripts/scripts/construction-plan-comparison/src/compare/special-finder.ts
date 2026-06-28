import type { SpecialParagraph, TextChunk } from '../types.ts'
import { extractKeywords } from './keyword-utils.ts'

/**
 * 低频 N-gram + 领域关键词 非标内容筛选
 */
export function findSpecialParagraphs(chunks: TextChunk[]): SpecialParagraph[] {
	const ngramSize = 4

	// 统计所有 4-gram 频次
	const allNgrams = new Map<string, number>()
	for (const c of chunks) {
		const cleaned = c.text.replace(/[^\u4e00-\u9fff0-9a-zA-Z]/g, '')
		const uniqueGrams = new Set<string>()
		for (let i = 0; i <= cleaned.length - ngramSize; i++) {
			uniqueGrams.add(cleaned.slice(i, i + ngramSize))
		}
		for (const gram of uniqueGrams) {
			allNgrams.set(gram, (allNgrams.get(gram) ?? 0) + 1)
		}
	}

	// 低频 ngram（出现 1~3 次）
	const rareGrams = new Set<string>()
	for (const [g, c] of allNgrams) {
		if (c >= 1 && c <= 3) rareGrams.add(g)
	}

	const special: SpecialParagraph[] = []
	const isToc = /第[一二三四五六七八九十]+章|目录|第\d+节|\.\.\.\.+/

	for (const c of chunks) {
		const cleaned = c.text.replace(/[^\u4e00-\u9fff0-9a-zA-Z]/g, '')
		const grams = new Set<string>()
		for (let i = 0; i <= cleaned.length - ngramSize; i++) {
			grams.add(cleaned.slice(i, i + ngramSize))
		}
		if (grams.size === 0) continue

		// 计算稀有度得分
		let rareCount = 0
		for (const g of grams) {
			if (rareGrams.has(g)) rareCount++
		}
		const ngramScore = rareCount / grams.size

		// 领域关键词加成：包含型号/规格说明非标可能性更高
		const keywords = extractKeywords(c.text)
		const keywordBoost = Math.min(keywords.length * 0.03, 0.15)
		const score = Math.min(ngramScore + keywordBoost, 1)

		// 过滤目录和太短的文本
		if (score > 0.3 && !isToc.test(c.text) && c.text.length > 30) {
			const models = keywords.slice(0, 20)
			const rareGramList = [...grams].filter((g) => rareGrams.has(g)).slice(0, 10)

			special.push({
				doc: c.doc,
				page: c.page,
				chunkId: c.id,
				score: Math.round(score * 10000) / 10000,
				models,
				rareGrams: rareGramList,
			})
		}
	}

	special.sort((a, b) => b.score - a.score)
	return special
}
