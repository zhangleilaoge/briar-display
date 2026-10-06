'use client'

import { isTokenUsable } from '@/api/auth'
import { addWatchlist, getWatchlist, removeWatchlist } from '@/api/markets'
import { type StockRef, WATCHLIST_LIMIT, type WatchlistItem } from '@briar/shared'
import { useEffect, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { readableError } from './useMarketPolling'
import {
	WATCHLIST_STORAGE_KEY,
	addStock,
	hasStock,
	itemsToImport,
	parseStoredWatchlist,
	removeStock,
} from './watchlistOps'

/**
 * 自选股存储（全页面共享一份，概览卡片和详情弹窗的「加自选」按钮同步）：
 * - 登录用户：服务端按账号存（GET/POST/DELETE /api/markets/watchlist），跨设备互通；
 *   首次加载时把本机访客自选合并进账号，然后清掉本机副本
 * - 访客：localStorage（身份本来就绑定设备）
 */
interface WatchlistState {
	items: WatchlistItem[]
	ready: boolean
	mode: 'server' | 'local'
}

const INITIAL: WatchlistState = { items: [], ready: false, mode: 'local' }
let state = INITIAL
const listeners = new Set<() => void>()
let initPromise: Promise<void> | null = null

const emit = (next: Partial<WatchlistState>) => {
	state = { ...state, ...next }
	for (const l of listeners) l()
}

const loadLocal = () => parseStoredWatchlist(window.localStorage.getItem(WATCHLIST_STORAGE_KEY))
const saveLocal = (items: WatchlistItem[]) =>
	window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(items))

function initWatchlist(): Promise<void> {
	if (initPromise) return initPromise
	initPromise = (async () => {
		const local = loadLocal()
		if (!isTokenUsable()) {
			emit({ items: local, ready: true, mode: 'local' })
			return
		}
		try {
			const res = await getWatchlist()
			if (!res.success || !res.data) throw new Error(res.message || '加载自选失败')
			let items = res.data
			const pending = itemsToImport(local, items)
			if (pending.length) {
				const merged = await addWatchlist(pending)
				if (merged.success && merged.data) {
					items = merged.data
					window.localStorage.removeItem(WATCHLIST_STORAGE_KEY)
					toast.success(`已把本机的 ${pending.length} 只自选同步到账号`)
				}
			} else if (local.length) {
				window.localStorage.removeItem(WATCHLIST_STORAGE_KEY)
			}
			emit({ items, ready: true, mode: 'server' })
		} catch {
			// 登录态失效（401 时拦截器已清 token）或网络失败：先用本机自选，下次登录再合并
			emit({ items: local, ready: true, mode: 'local' })
		}
	})()
	return initPromise
}

export async function addToWatchlist(stock: StockRef) {
	await initWatchlist()
	if (hasStock(state.items, stock)) return
	if (state.items.length >= WATCHLIST_LIMIT) {
		toast.error(`自选最多 ${WATCHLIST_LIMIT} 只`)
		return
	}
	const prev = state.items
	emit({ items: addStock(prev, stock) })
	if (state.mode === 'local') {
		saveLocal(state.items)
		return
	}
	try {
		const res = await addWatchlist([stock])
		if (!res.success || !res.data) throw new Error(res.message || '加入自选失败')
		emit({ items: res.data })
	} catch (err) {
		emit({ items: prev })
		toast.error(`加入自选失败：${readableError(err)}`)
	}
}

export async function removeFromWatchlist(stock: Pick<StockRef, 'market' | 'code'>) {
	await initWatchlist()
	const prev = state.items
	emit({ items: removeStock(prev, stock) })
	if (state.mode === 'local') {
		saveLocal(state.items)
		return
	}
	try {
		const res = await removeWatchlist(stock.market, stock.code)
		if (!res.success || !res.data) throw new Error(res.message || '移出自选失败')
		emit({ items: res.data })
	} catch (err) {
		emit({ items: prev })
		toast.error(`移出自选失败：${readableError(err)}`)
	}
}

const subscribe = (l: () => void) => {
	listeners.add(l)
	return () => listeners.delete(l)
}

export function useWatchlist() {
	const snap = useSyncExternalStore(
		subscribe,
		() => state,
		() => INITIAL,
	)
	useEffect(() => {
		initWatchlist()
	}, [])
	return {
		...snap,
		has: (s: Pick<StockRef, 'market' | 'code'>) => hasStock(snap.items, s),
		add: addToWatchlist,
		remove: removeFromWatchlist,
	}
}
