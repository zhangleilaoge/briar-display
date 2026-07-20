import { getStore } from '@/lib/idb'

const MAX_HISTORY = 50
const THUMBNAIL_MAX_PX = 64

// ======================== 类型定义 ========================

export interface CompressHistoryEntry {
	id: string
	userId: string
	name: string
	originalSize: number
	compressedSize: number
	width: number
	height: number
	newWidth: number
	newHeight: number
	format: string
	timestamp: number
	/** 压缩后的完整图片 Blob，存 IndexedDB 无体积限制 */
	blob: Blob
	/** 小尺寸 base64 缩略图，用于快速预览 */
	thumbnail: string
}

// ======================== Store 实例 ========================

const store = () =>
	getStore<CompressHistoryEntry>('compressHistory', {
		maxEntries: MAX_HISTORY,
		evictKey: 'timestamp',
	})

// ======================== CRUD ========================

/** 加载当前用户的所有历史记录（按时间倒序） */
export async function loadCompressHistory(userId: string): Promise<CompressHistoryEntry[]> {
	const all = await store().listByIndex('byTimestamp', 'prev')
	return all.filter((e) => e.userId === userId)
}

/** 添加一条历史记录（自动淘汰旧条目） */
export async function pushCompressHistory(
	entry: CompressHistoryEntry,
): Promise<CompressHistoryEntry[]> {
	await store().put(entry)
	return loadCompressHistory(entry.userId)
}

/** 删除单条 */
export async function deleteCompressHistoryEntry(id: string): Promise<void> {
	await store().delete(id)
}

/** 清空当前用户的所有记录 */
export async function clearCompressHistory(userId: string): Promise<void> {
	const entries = await loadCompressHistory(userId)
	const ids = entries.map((e) => e.id)
	if (ids.length > 0) {
		await store().deleteMany(ids)
	}
}

// ======================== 工具函数 ========================

/**
 * 从 Canvas 生成一个小缩略图 base64 data URL（仅用于 UI 预览）
 */
export function generateThumbnail(sourceCanvas: HTMLCanvasElement): string {
	const { width, height } = sourceCanvas
	const scale = Math.min(THUMBNAIL_MAX_PX / width, THUMBNAIL_MAX_PX / height, 1)
	const tw = Math.round(width * scale)
	const th = Math.round(height * scale)

	const canvas = document.createElement('canvas')
	canvas.width = tw
	canvas.height = th
	const ctx = canvas.getContext('2d')
	if (!ctx) return ''
	ctx.drawImage(sourceCanvas, 0, 0, tw, th)
	return canvas.toDataURL('image/jpeg', 0.5)
}

/**
 * 从 Blob 生成 Object URL（用于 img src）
 * 注意：调用者需要在组件卸载时 revokeObjectURL
 */
export function blobToUrl(blob: Blob): string {
	return URL.createObjectURL(blob)
}

export function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function compressRatio(originalSize: number, compressedSize: number): number {
	return Math.round((1 - compressedSize / originalSize) * 100)
}

/**
 * 根据 format 返回文件扩展名
 */
export function getExtFromFormat(format: string): string {
	if (format === 'image/jpeg') return '.jpg'
	if (format === 'image/webp') return '.webp'
	return '.png'
}
