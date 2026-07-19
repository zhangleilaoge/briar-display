import { Braces, Code, Eraser, FileJson, Minus, Shield, WrapText } from 'lucide-react'

export const HISTORY_KEY = 'briar:json-history'
export const MAX_HISTORY = 50

export type ActionKey =
	| 'format'
	| 'minify'
	| 'escape'
	| 'unescape'
	| 'escapeUnicode'
	| 'unescapeUnicode'
	| 'toObject'
	| 'toJson'

export interface HistoryEntry {
	id: string
	input: string
	action: ActionKey
	timestamp: number
	tags: string[]
}

export interface ActionDef {
	key: ActionKey
	label: string
	icon: React.ReactNode
}

export const ACTIONS: ActionDef[] = [
	{ key: 'format', label: '格式化', icon: <WrapText className="h-4 w-4" /> },
	{ key: 'minify', label: '压缩', icon: <Minus className="h-4 w-4" /> },
	{ key: 'toObject', label: '转对象', icon: <FileJson className="h-4 w-4" /> },
	{ key: 'toJson', label: '转 JSON', icon: <Code className="h-4 w-4" /> },
	{ key: 'escape', label: '加转义', icon: <Shield className="h-4 w-4" /> },
	{ key: 'unescape', label: '去转义', icon: <Eraser className="h-4 w-4" /> },
	{ key: 'escapeUnicode', label: '转 Unicode', icon: <Braces className="h-4 w-4" /> },
	{ key: 'unescapeUnicode', label: '去 Unicode', icon: <Braces className="h-4 w-4" /> },
]

// ─── 时间 / 大小格式化 ───

export function formatRelativeTime(ts: number, now: number): string {
	const diff = now - ts
	const mins = Math.floor(diff / 60000)
	if (mins < 1) return '刚刚'
	if (mins < 60) return `${mins}分钟前`
	const hours = Math.floor(mins / 60)
	if (hours < 24) return `${hours}小时前`
	const days = Math.floor(hours / 24)
	if (days < 7) return `${days}天前`
	const d = new Date(ts)
	return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

export function formatFullTime(ts: number): string {
	const d = new Date(ts)
	const pad = (n: number) => String(n).padStart(2, '0')
	return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function formatSize(text: string): string {
	const bytes = new Blob([text]).size
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── 历史记录 ──

export function loadHistory(): HistoryEntry[] {
	try {
		const raw = localStorage.getItem(HISTORY_KEY)
		if (raw) return JSON.parse(raw)
	} catch {}
	return []
}

export function saveHistory(entries: HistoryEntry[]) {
	try {
		localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))
	} catch {}
}

// ── JSON 解析 ──

export function normalizeQuotes(text: string): string {
	return text.replace(/'/g, '"')
}

// 给未加引号的 key 补双引号，使 JS 对象字面量变为合法 JSON
// 使用状态机逐字符扫描，跳过字符串内容避免误匹配
export function quoteUnquotedKeys(text: string): string {
	let result = ''
	let i = 0
	const len = text.length

	while (i < len) {
		const ch = text[i]

		// 处理字符串字面量 — 原样保留，跳过内部内容
		if (ch === '"' || ch === "'") {
			const quote = ch
			result += ch
			i++
			while (i < len) {
				if (text[i] === '\\') {
					result += text[i] + text[i + 1]
					i += 2
				} else if (text[i] === quote) {
					result += text[i]
					i++
					break
				} else {
					result += text[i]
					i++
				}
			}
			continue
		}

		// 在字符串外部：检测未加引号的 key
		if (/[\w$]/.test(ch)) {
			// 检查前面是否紧挨着引号（已加引号的 key）
			let j = result.length - 1
			while (j >= 0 && result[j] === ' ') j--
			if (j >= 0 && (result[j] === '"' || result[j] === "'")) {
				result += ch
				i++
				continue
			}

			// 收集完整单词
			const wordStart = i
			while (i < len && /[\w$]/.test(text[i])) i++
			const word = text.slice(wordStart, i)

			// 跳过空白
			const wsStart = i
			while (i < len && text[i] === ' ') i++

			// 如果后面是冒号 → 这是 key，加引号
			if (i < len && text[i] === ':') {
				result += `"${word}"`
				// 空白已消耗，不输出
			} else {
				// 不是 key，原样输出单词+空白
				result += word + text.slice(wsStart, i)
			}
			continue
		}

		result += ch
		i++
	}

	return result
}

// 检测输入是否为 JS 对象字面量（需要补引号才能解析）
export function isObjectLiteral(text: string): boolean {
	const trimmed = text.trim()
	if (!trimmed) return false
	// 标准 JSON 能直接解析 → 不是对象字面量
	try {
		JSON.parse(trimmed)
		return false
	} catch {}
	// 单引号替换后能解析 → 不算对象字面量（只是引号风格不同）
	try {
		JSON.parse(normalizeQuotes(trimmed))
		return false
	} catch {}
	// 补引号后能解析 → 是对象字面量
	try {
		JSON.parse(quoteUnquotedKeys(normalizeQuotes(trimmed)))
		return true
	} catch {}
	return false
}

export function tryParseJson(text: string): { value: unknown; valid: boolean; error?: string } {
	try {
		const value = JSON.parse(text)
		return { value, valid: true }
	} catch {
		try {
			const value = JSON.parse(normalizeQuotes(text))
			return { value, valid: true }
		} catch {
			try {
				const value = JSON.parse(quoteUnquotedKeys(normalizeQuotes(text)))
				return { value, valid: true }
			} catch (e) {
				return { value: undefined, valid: false, error: (e as Error).message }
			}
		}
	}
}

// ─── 标签计算 ───

export function computeTags(text: string): string[] {
	const tags: string[] = []
	if (!text.trim()) return tags
	const trimmed = text.trim()
	// 标准 JSON 直接解析成功 → JSON
	try {
		const v = JSON.parse(text)
		tags.push('JSON')
		if (!trimmed.includes('\n') && trimmed === JSON.stringify(v)) {
			tags.push('压缩')
		}
		return tags
	} catch {}
	// 需要补引号才能解析 → 对象字面量
	try {
		const v = JSON.parse(quoteUnquotedKeys(normalizeQuotes(trimmed)))
		if (typeof v === 'object' && v !== null) {
			tags.push('对象')
			return tags
		}
	} catch {}
	// 都解析不了 → 非法
	tags.push('非法')
	return tags
}

// ─── 字符串操作 ───

export function escapeJsonString(str: string): string {
	return JSON.stringify(str).slice(1, -1)
}

export function unescapeJsonString(str: string): string {
	try {
		return JSON.parse(`"${str}"`)
	} catch {
		return str
	}
}

export function unicodeEscape(str: string): string {
	return str.replace(/[^\0-\x7f]/g, (c) => {
		const code = c.codePointAt(0) ?? 0
		return code > 0xffff ? `\\u{${code.toString(16)}}` : `\\u${code.toString(16).padStart(4, '0')}`
	})
}

export function unicodeUnescape(str: string): string {
	return str.replace(/\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})/g, (_, hex1, hex2) => {
		const code = Number.parseInt(hex1 || hex2, 16)
		return String.fromCodePoint(code)
	})
}

// ─── JSON 对象 → JS 对象字面量（去掉 key 引号） ───

export function toObjectLiteral(value: unknown, indent = 0): string {
	const pad = '  '.repeat(indent)
	const innerPad = '  '.repeat(indent + 1)

	if (value === null) return 'null'
	if (value === undefined) return 'undefined'

	if (typeof value === 'string') {
		// 字符串值保留双引号
		return JSON.stringify(value)
	}
	if (typeof value === 'number' || typeof value === 'boolean') {
		return String(value)
	}
	if (Array.isArray(value)) {
		if (value.length === 0) return '[]'
		const items = value.map((v) => `${innerPad}${toObjectLiteral(v, indent + 1)}`)
		return `[\n${items.join(',\n')}\n${pad}]`
	}
	if (typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>)
		if (entries.length === 0) return '{}'
		const items = entries.map(([k, v]) => {
			// key 不加引号（合法 JS 标识符时），否则保留引号
			const key = /^[a-zA-Z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)
			return `${innerPad}${key}: ${toObjectLiteral(v, indent + 1)}`
		})
		return `{\n${items.join(',\n')}\n${pad}}`
	}
	return String(value)
}

// ─── 操作执行 ───

export function executeAction(key: ActionKey, input: string): string {
	switch (key) {
		case 'format': {
			const { value, valid, error } = tryParseJson(input)
			if (!valid) throw new Error(error)
			return JSON.stringify(value, null, 2)
		}
		case 'minify': {
			const { value, valid, error } = tryParseJson(input)
			if (!valid) throw new Error(error)
			return JSON.stringify(value)
		}
		case 'toObject': {
			const { value, valid, error } = tryParseJson(input)
			if (!valid) throw new Error(error)
			let target = value
			// 如果解析结果是字符串，再解析一层
			if (typeof value === 'string') {
				const v2 = tryParseJson(value)
				if (v2.valid && typeof v2.value === 'object' && v2.value !== null) {
					target = v2.value
				}
			}
			if (typeof target === 'object' && target !== null) {
				return toObjectLiteral(target)
			}
			throw new Error('输入不是合法的对象或对象字符串')
		}
		case 'toJson': {
			const { value, valid, error } = tryParseJson(input)
			if (!valid) throw new Error(error)
			let target = value
			if (typeof value === 'string') {
				const v2 = tryParseJson(value)
				if (v2.valid && typeof v2.value === 'object' && v2.value !== null) {
					target = v2.value
				}
			}
			if (typeof target === 'object' && target !== null) {
				return JSON.stringify(target)
			}
			throw new Error('输入不是合法的对象或对象字符串')
		}
		case 'escape': {
			const { value, valid } = tryParseJson(input)
			return valid ? escapeJsonString(JSON.stringify(value)) : escapeJsonString(input)
		}
		case 'unescape': {
			const unescaped = unescapeJsonString(input)
			const { value, valid } = tryParseJson(unescaped)
			return valid ? JSON.stringify(value, null, 2) : unescaped
		}
		case 'escapeUnicode': {
			const { value, valid, error } = tryParseJson(input)
			if (!valid) throw new Error(error)
			return unicodeEscape(JSON.stringify(value))
		}
		case 'unescapeUnicode': {
			const unescaped = unicodeUnescape(input)
			const { value, valid } = tryParseJson(unescaped)
			return valid ? JSON.stringify(value, null, 2) : unescaped
		}
	}
}

// ─── 树状预览解析 ───

export function parseForPreview(input: string): { parsedValue: unknown; isObjectInput: boolean } {
	if (!input.trim()) return { parsedValue: null, isObjectInput: false }
	// 只有标准 JSON 直接解析成功才算「已是 JSON 对象」
	// 需要补引号才能解析的属于对象字面量，不算标准 JSON
	try {
		const v = JSON.parse(input)
		if (typeof v === 'object' && v !== null) {
			return { parsedValue: v, isObjectInput: true }
		}
		if (typeof v === 'string') {
			try {
				const v2 = JSON.parse(v)
				if (v2 !== null && typeof v2 === 'object') {
					return { parsedValue: v2, isObjectInput: false }
				}
			} catch {}
		}
		return { parsedValue: v, isObjectInput: false }
	} catch {
		// 标准 JSON 解析失败 → 尝试兜底解析用于预览，但不算「已是 JSON」
		try {
			const v = JSON.parse(normalizeQuotes(input))
			if (typeof v === 'object' && v !== null) {
				return { parsedValue: v, isObjectInput: false }
			}
			return { parsedValue: v, isObjectInput: false }
		} catch {
			try {
				const v = JSON.parse(quoteUnquotedKeys(normalizeQuotes(input)))
				if (typeof v === 'object' && v !== null) {
					return { parsedValue: v, isObjectInput: false }
				}
				return { parsedValue: v, isObjectInput: false }
			} catch {
				return { parsedValue: null, isObjectInput: false }
			}
		}
	}
}
