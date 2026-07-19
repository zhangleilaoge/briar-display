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
