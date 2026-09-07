/** 从原始文件名提取安全的扩展名 */
export function getExtFromName(name: string): string {
	const idx = name.lastIndexOf('.')
	if (idx < 0) return ''
	const ext = name.slice(idx).toLowerCase()
	return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : ''
}

/** 常见扩展名 → MIME；客户端 mimeType 缺失或 octet-stream 时按文件名纠偏 */
const EXT_MIME_MAP: Record<string, string> = {
	'.webp': 'image/webp',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.gif': 'image/gif',
	'.bmp': 'image/bmp',
	'.svg': 'image/svg+xml',
	'.avif': 'image/avif',
	'.mp4': 'video/mp4',
	'.mov': 'video/quicktime',
	'.webm': 'video/webm',
	'.m4v': 'video/mp4',
	'.mp3': 'audio/mpeg',
	'.m4a': 'audio/mp4',
	'.wav': 'audio/wav',
	'.ogg': 'audio/ogg',
	'.md': 'text/markdown',
	'.markdown': 'text/markdown',
	'.txt': 'text/plain',
	'.log': 'text/plain',
	'.json': 'application/json',
	'.csv': 'text/csv',
}

/** 客户端 MIME 不可信（可能为空或 octet-stream），按扩展名兜底纠偏 */
export function resolveMimeType(name: string, mimeType?: string): string {
	if (mimeType && mimeType !== 'application/octet-stream') return mimeType
	return EXT_MIME_MAP[getExtFromName(name)] || mimeType || 'application/octet-stream'
}
