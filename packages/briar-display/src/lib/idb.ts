/**
 * Briar IndexedDB 统一管理工具
 *
 * 基于 `idb`（Jake Archibald）封装，提供高扩展性的本地持久化方案。
 * 每个业务模块注册一个独立 store，互不干扰。
 *
 * 使用方式：
 *   const compressStore = getStore<CompressEntry>('compressHistory')
 *   await compressStore.add(entry)
 *   const all = await compressStore.list()
 */
import { type IDBPDatabase, openDB } from 'idb'

// ======================== DB Schema ========================

const DB_NAME = 'briar'
const DB_VERSION = 1

/** 所有 store 的定义：name → keyPath + indexes */
const STORE_DEFS = {
	compressHistory: {
		keyPath: 'id',
		indexes: {
			byTimestamp: 'timestamp',
			byUserId: 'userId',
		},
	},
	// 未来扩展示例：
	// jsonHistory: { keyPath: 'id', indexes: { byTimestamp: 'timestamp' } },
} as const

type StoreName = keyof typeof STORE_DEFS

// ======================== DB 初始化 ========================

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB(): Promise<IDBPDatabase> {
	if (!dbPromise) {
		dbPromise = openDB(DB_NAME, DB_VERSION, {
			upgrade(db) {
				for (const [name, def] of Object.entries(STORE_DEFS)) {
					if (!db.objectStoreNames.contains(name)) {
						const store = db.createObjectStore(name, { keyPath: def.keyPath })
						for (const [indexName, keyPath] of Object.entries(def.indexes)) {
							store.createIndex(indexName, keyPath)
						}
					}
				}
			},
		})
	}
	return dbPromise
}

// ======================== Store 操作封装 ========================

interface StoreOptions {
	/** 最大记录数，超出后按 timestamp 升序淘汰旧条目。0 = 不限制 */
	maxEntries?: number
	/** 按哪个字段淘汰，默认 'timestamp' */
	evictKey?: string
}

class BriarStore<T extends { id: string }> {
	private storeName: string
	private options: StoreOptions

	constructor(storeName: string, options: StoreOptions = {}) {
		this.storeName = storeName
		this.options = options
	}

	/** 写入一条记录 */
	async put(value: T): Promise<T> {
		const db = await getDB()
		await db.put(this.storeName, value)
		await this._evictIfNeeded(db)
		return value
	}

	/** 批量写入 */
	async putMany(values: T[]): Promise<T[]> {
		const db = await getDB()
		const tx = db.transaction(this.storeName, 'readwrite')
		for (const v of values) {
			await tx.store.put(v)
		}
		await tx.done
		await this._evictIfNeeded(db)
		return values
	}

	/** 按 id 获取单条 */
	async get(id: string): Promise<T | undefined> {
		const db = await getDB()
		return db.get(this.storeName, id) as Promise<T | undefined>
	}

	/** 获取所有记录（默认按 key 排序） */
	async list(): Promise<T[]> {
		const db = await getDB()
		return db.getAll(this.storeName) as Promise<T[]>
	}

	/** 按索引列出，可指定排序方向 */
	async listByIndex(indexName: string, direction: IDBCursorDirection = 'prev'): Promise<T[]> {
		const db = await getDB()
		const tx = db.transaction(this.storeName, 'readonly')
		const index = tx.store.index(indexName)
		const results: T[] = []
		let cursor = await index.openCursor(null, direction)
		while (cursor) {
			results.push(cursor.value as T)
			cursor = await cursor.continue()
		}
		return results
	}

	/** 按 id 删除 */
	async delete(id: string): Promise<void> {
		const db = await getDB()
		await db.delete(this.storeName, id)
	}

	/** 批量删除 */
	async deleteMany(ids: string[]): Promise<void> {
		const db = await getDB()
		const tx = db.transaction(this.storeName, 'readwrite')
		for (const id of ids) {
			await tx.store.delete(id)
		}
		await tx.done
	}

	/** 清空 store */
	async clear(): Promise<void> {
		const db = await getDB()
		await db.clear(this.storeName)
	}

	/** 统计条数 */
	async count(): Promise<number> {
		const db = await getDB()
		return db.count(this.storeName)
	}

	/** 淘汰超出上限的旧条目 */
	private async _evictIfNeeded(db: IDBPDatabase): Promise<void> {
		const { maxEntries, evictKey = 'timestamp' } = this.options
		if (!maxEntries || maxEntries <= 0) return

		const count = await db.count(this.storeName)
		if (count <= maxEntries) return

		const tx = db.transaction(this.storeName, 'readwrite')
		// 尝试用索引排序淘汰
		try {
			const index = tx.store.index(`by${evictKey.charAt(0).toUpperCase()}${evictKey.slice(1)}`)
			let cursor = await index.openCursor(null, 'next')
			let toDelete = count - maxEntries
			while (cursor && toDelete > 0) {
				await cursor.delete()
				toDelete--
				cursor = await cursor.continue()
			}
		} catch {
			// 索引不存在，忽略淘汰
		}
		await tx.done
	}
}

// ======================== Store 工厂 ========================

const storeCache = new Map<string, BriarStore<any>>()

/**
 * 获取指定 store 的操作实例（单例缓存）
 *
 * @example
 * ```ts
 * const compressStore = getStore<CompressHistoryEntry>('compressHistory', { maxEntries: 50 })
 * await compressStore.put(entry)
 * const all = await compressStore.list()
 * ```
 */
export function getStore<T extends { id: string }>(
	storeName: StoreName,
	options?: StoreOptions,
): BriarStore<T> {
	const key = storeName
	if (!storeCache.has(key)) {
		storeCache.set(key, new BriarStore<T>(storeName, options))
	}
	return storeCache.get(key)!
}
