import { DEFAULT_RIBBON_ORDER } from './ribbon-items'
import type { RibbonTagKind } from './ribbon-tags'
import { normalizeRibbonOrder } from './ribbonPreferences'

const CACHE_PREFIX = 'briar:ribbon-navigation:'

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

export function readRibbonOrderCache(storage: ReadStorage): RibbonTagKind[] | null {
	try {
		if (!storage.getItem('briar_token')) return null
		const userId = cachedUserId(storage)
		if (!userId) return null
		const raw = storage.getItem(`${CACHE_PREFIX}${userId}`)
		if (!raw) return null
		return normalizeRibbonOrder(JSON.parse(raw), DEFAULT_RIBBON_ORDER)
	} catch {
		return null
	}
}

export function writeRibbonOrderCache(
	storage: WriteStorage,
	userId: string | number,
	order: readonly RibbonTagKind[],
): boolean {
	try {
		storage.setItem(`${CACHE_PREFIX}${userId}`, JSON.stringify(order))
		return true
	} catch {
		return false
	}
}
