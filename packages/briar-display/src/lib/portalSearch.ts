import { pinyin } from 'pinyin-pro'

const norm = (v: string) => v.toLowerCase().replace(/\s+/g, '')

const cache = new Map<string, { full: string; initial: string }>()

function forms(text: string) {
	const hit = cache.get(text)
	if (hit) return hit
	const chars = [...text]
	const fullParts: string[] = []
	const initialParts: string[] = []
	for (const ch of chars) {
		if (/[\u4e00-\u9fff]/.test(ch)) {
			const full = pinyin(ch, { toneType: 'none', type: 'array' })
			const first = pinyin(ch, { pattern: 'first', toneType: 'none', type: 'array' })
			fullParts.push(...full.map((s) => s.toLowerCase()))
			initialParts.push(...first.map((s) => s.toLowerCase()))
		} else {
			const c = ch.toLowerCase()
			fullParts.push(c)
			initialParts.push(c)
		}
	}
	const out = { full: fullParts.join(''), initial: initialParts.join('') }
	cache.set(text, out)
	return out
}

/** 原文 / 全拼 / 简拼任一包含 query（去空白、小写）即命中 */
export function textMatchesQuery(text: string, query: string): boolean {
	const q = norm(query)
	if (!q) return true
	if (!text) return false
	if (norm(text).includes(q)) return true
	const { full, initial } = forms(text)
	return full.includes(q) || initial.includes(q)
}

/** 多个字段任一命中 */
export function fieldsMatchQuery(fields: Array<string | undefined | null>, query: string): boolean {
	const q = norm(query)
	if (!q) return true
	return fields.some((f) => f != null && textMatchesQuery(f, q))
}

export { norm as normalizePortalQuery }
