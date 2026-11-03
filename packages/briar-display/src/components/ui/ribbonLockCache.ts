const CACHE_PREFIX = 'briar:ribbon-locked:'

type ReadStorage = Pick<Storage, 'getItem'>
type WriteStorage = Pick<Storage, 'setItem'>

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

export function readRibbonLockCache(storage: ReadStorage): boolean | null {
	try {
		if (!storage.getItem('briar_token')) return null
		const userId = cachedUserId(storage)
		if (!userId) return null
		const value: unknown = JSON.parse(storage.getItem(`${CACHE_PREFIX}${userId}`) ?? 'null')
		return typeof value === 'boolean' ? value : null
	} catch {
		return null
	}
}

export function writeRibbonLockCache(
	storage: WriteStorage,
	userId: string | number,
	locked: boolean,
): boolean {
	try {
		storage.setItem(`${CACHE_PREFIX}${userId}`, JSON.stringify(locked))
		return true
	} catch {
		return false
	}
}
