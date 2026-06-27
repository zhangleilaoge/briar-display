import type { SpecialParagraph, TextChunk } from '../types.ts'

/**
 * 低频 N-gram 非标内容筛选
 */
export function findSpecialParagraphs(chunks: TextChunk[]): SpecialParagraph[] {
	const eqPattern = /[A-Z]+[-/]?\d+[A-Z\d/-]*|[A-Z]{2,}\d{2,}[A-Z\d/-]*/g
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
		const score = rareCount / grams.size

		// 过滤目录和太短的文本
		if (score > 0.3 && !isToc.test(c.text) && c.text.length > 30) {
			const models = [...new Set((c.text.match(eqPattern) ?? []).filter((m) => m.length >= 3))]
			const rareGramList = [...grams].filter((g) => rareGrams.has(g)).slice(0, 10)

			special.push({
				doc: c.doc,
				page: c.page,
				text: c.text,
				score: Math.round(score * 10000) / 10000,
				models,
				rareGrams: rareGramList,
			})
		}
	}

	special.sort((a, b) => b.score - a.score)
	return special
}
