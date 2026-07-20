import type { Change } from 'diff'

export const HISTORY_KEY = 'briar:diff-history'
export const MAX_HISTORY = 50
export const CACHE_KEY = 'briar:diff-cache'

export interface HistoryEntry {
	id: string
	leftText: string
	rightText: string
	timestamp: number
}

export type ViewMode = 'split' | 'unified'

export interface DiffStats {
	added: number
	removed: number
}

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

// ─── 历史记录 ───

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

// ─── Diff 计算 ───

export function computeStats(changes: Change[]): DiffStats {
	let added = 0
	let removed = 0
	for (const c of changes) {
		const count = c.value.endsWith('\n')
			? c.value.split('\n').length - 1
			: c.value.split('\n').length
		if (c.added) added += count
		else if (c.removed) removed += count
	}
	return { added, removed }
}

// ─── Diff 分段（GitLab 风格：折叠相同区域） ───

/** 变更行前后保留的上下文行数 */
export const CONTEXT_LINES = 3

export interface DiffLine {
	leftNum: number | null
	rightNum: number | null
	text: string
	type: 'normal' | 'added' | 'removed'
}

export type DiffSegment =
	| { kind: 'lines'; lines: DiffLine[] }
	| { kind: 'collapsed'; lines: DiffLine[] }

/**
 * 将 diffLines 的结果展平为带行号的行列表，再按上下文切分为
 * 可见 hunk 与可折叠的相同区域（类似 GitLab diff 视图）。
 */
export function buildDiffSegments(changes: Change[], context = CONTEXT_LINES): DiffSegment[] {
	const allLines: DiffLine[] = []
	let leftNum = 0
	let rightNum = 0
	for (const change of changes) {
		const lines = change.value.split('\n')
		if (lines[lines.length - 1] === '') lines.pop()
		for (const text of lines) {
			if (change.added) {
				rightNum++
				allLines.push({ leftNum: null, rightNum, text, type: 'added' })
			} else if (change.removed) {
				leftNum++
				allLines.push({ leftNum, rightNum: null, text, type: 'removed' })
			} else {
				leftNum++
				rightNum++
				allLines.push({ leftNum, rightNum, text, type: 'normal' })
			}
		}
	}

	const n = allLines.length
	const visible = new Array<boolean>(n).fill(false)
	let hasChange = false
	for (let i = 0; i < n; i++) {
		if (allLines[i].type === 'normal') continue
		hasChange = true
		for (let j = Math.max(0, i - context); j <= Math.min(n - 1, i + context); j++) {
			visible[j] = true
		}
	}
	// 完全没有变更时不做折叠
	if (!hasChange) return [{ kind: 'lines', lines: allLines }]

	const segments: DiffSegment[] = []
	let i = 0
	while (i < n) {
		const isVisible = visible[i]
		const lines: DiffLine[] = []
		while (i < n && visible[i] === isVisible) {
			lines.push(allLines[i])
			i++
		}
		segments.push({ kind: isVisible ? 'lines' : 'collapsed', lines })
	}
	return segments
}

// ─── 缓存 ───

export function loadCache(): { leftText?: string; rightText?: string } {
	try {
		const raw = localStorage.getItem(CACHE_KEY)
		if (raw) return JSON.parse(raw)
	} catch {}
	return {}
}

export function saveCache(leftText: string, rightText: string) {
	try {
		localStorage.setItem(CACHE_KEY, JSON.stringify({ leftText, rightText, updatedAt: Date.now() }))
	} catch {}
}

export function clearCache() {
	try {
		localStorage.removeItem(CACHE_KEY)
	} catch {}
}
