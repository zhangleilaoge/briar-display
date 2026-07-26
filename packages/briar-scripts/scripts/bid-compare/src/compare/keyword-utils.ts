/**
 * 施工方案领域关键词提取
 */

// 型号/设备编号：如 CRH380A、ABC-1234、Φ8、C30、M15
const MODEL_PATTERN = /[A-Z]+[-/]?\d+[A-Z\d/-]*|[A-Z]{2,}\d{2,}[A-Z\d/-]*/g

// 工程规格：混凝土强度 C30、钢筋直径 Φ8、砂浆等级 M15、尺寸 300mm 等
const SPEC_PATTERNS = [
	/C\d{1,3}/g, // C30, C20
	/Φ\d{1,3}(?:\.\d+)?/g, // Φ8, Φ12.5
	/M\d{1,3}/g, // M15, M10
	/\d{1,4}\s*mm/g, // 300mm
	/\d{1,3}(?:\.\d+)?\s*m²/g, // 100m²
	/HRB\d{3,4}/g, // HRB400
	/SBS[\w-]*/g, // SBS 防水卷材
	/XPS[\w-]*/g, // XPS 保温板
]

export function extractKeywords(text: string): string[] {
	const keywords = new Set<string>()

	for (const match of text.matchAll(MODEL_PATTERN)) {
		const kw = match[0].trim()
		if (kw.length >= 2) keywords.add(kw)
	}

	for (const pattern of SPEC_PATTERNS) {
		for (const match of text.matchAll(pattern)) {
			const kw = match[0].replace(/\s+/g, '').trim()
			if (kw.length >= 2) keywords.add(kw)
		}
	}

	return Array.from(keywords)
}

export function keywordOverlapScore(a: string, b: string): number {
	const kwsA = new Set(extractKeywords(a))
	const kwsB = new Set(extractKeywords(b))
	if (kwsA.size === 0 || kwsB.size === 0) return 0

	let common = 0
	for (const kw of kwsA) {
		if (kwsB.has(kw)) common++
	}
	return common / Math.min(kwsA.size, kwsB.size)
}
