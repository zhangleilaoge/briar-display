/**
 * 工具箱 tab 显隐：存「隐藏的工具路径」而非「显示列表」，以后新增工具默认可见。
 * 登录用户落 user_preferences（key: tools-hidden），本地按用户缓存一份供首屏 / 入口重定向同步读取。
 */
export const TOOLS_HIDDEN_PREFERENCE_KEY = 'tools-hidden'
const CACHE_PREFIX = 'briar:tools-hidden:'

type ReadStorage = Pick<Storage, 'getItem'>
type WriteStorage = Pick<Storage, 'setItem'>

/** 过滤非法 / 重复路径；若会把全部工具藏掉则视为不隐藏（至少保留一个可见） */
export function normalizeHiddenTools(value: unknown, available: readonly string[]): string[] {
	if (!Array.isArray(value)) return []
	const allowed = new Set(available)
	const hidden: string[] = []
	for (const path of value) {
		if (typeof path !== 'string' || !allowed.has(path) || hidden.includes(path)) continue
		hidden.push(path)
	}
	if (available.length > 0 && hidden.length >= available.length) return []
	return hidden
}

/** 切换某个工具显隐；会导致全部隐藏时原样返回 */
export function toggleHiddenTool(
	hidden: readonly string[],
	path: string,
	visible: boolean,
	available: readonly string[],
): string[] {
	const next = visible ? hidden.filter((p) => p !== path) : [...hidden, path]
	const normalized = normalizeHiddenTools(next, available)
	if (!visible && normalized.length === 0 && next.length > 0) return [...hidden]
	return normalized
}

/** 顶栏展示的 tab：去掉隐藏项，但当前所在的工具即使被隐藏也保留，避免直链进入时 tab 消失 */
export function visibleToolItems<T extends { href: string }>(
	items: readonly T[],
	hidden: readonly string[],
	currentPath?: string,
): T[] {
	const set = new Set(hidden)
	return items.filter((item) => !set.has(item.href) || item.href === currentPath)
}

function cachedUserId(storage: ReadStorage): string | null {
	try {
		const raw = storage.getItem('briar_user')
		if (!raw) return null
		const user: unknown = JSON.parse(raw)
		if (!user || typeof user !== 'object') return null
		const id = (user as { id?: unknown }).id
		return typeof id === 'string' || typeof id === 'number' ? String(id) : null
	} catch {
		return null
	}
}

export function readHiddenToolsCache(
	storage: ReadStorage,
	available: readonly string[],
): string[] | null {
	try {
		if (!storage.getItem('briar_token')) return null
		const userId = cachedUserId(storage)
		if (!userId) return null
		const raw = storage.getItem(`${CACHE_PREFIX}${userId}`)
		if (!raw) return null
		return normalizeHiddenTools(JSON.parse(raw), available)
	} catch {
		return null
	}
}

export function writeHiddenToolsCache(
	storage: WriteStorage,
	userId: string | number,
	hidden: readonly string[],
): boolean {
	try {
		storage.setItem(`${CACHE_PREFIX}${userId}`, JSON.stringify(hidden))
		return true
	} catch {
		return false
	}
}
