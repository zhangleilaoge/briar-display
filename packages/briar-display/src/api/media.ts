import type { ApiResponse, MediaParseResult } from '@briar/shared'
import { apiClient } from './request'

/** 解析小红书分享链接，返回无水印媒体地址 */
export const parseMedia = async (url: string) => {
	const response = await apiClient.post<ApiResponse<MediaParseResult>>(
		'/media/parse',
		{ url },
		{ timeout: 90_000 },
	)
	return response.data
}

/** 分块大小：32MB。445MB 的 B站长视频约 14 块，单块失败只需重拉这一块 */
const CHUNK_SIZE = 32 * 1024 * 1024
/** 单块失败重试次数（网络抖动容错）；单块 120s 超时，卡死也能触发重试 */
const CHUNK_MAX_ATTEMPTS = 4
const CHUNK_TIMEOUT_MS = 120_000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface ChunkResult {
	/** 206 = 分块；200 = 上游不支持 Range，响应里已是全量 */
	status: number
	blob: Blob
	/** Content-Range 里的总大小（206 时存在） */
	total: number | null
}

const fetchChunk = async (
	url: string,
	start: number,
	end: number,
	from: string | undefined,
	onLoaded: (loaded: number) => void,
): Promise<ChunkResult> => {
	const response = await apiClient.get<Blob>('/media/proxy', {
		params: { url, from: from || undefined },
		responseType: 'blob',
		timeout: CHUNK_TIMEOUT_MS,
		headers: { Range: `bytes=${start}-${end}` },
		onDownloadProgress: (e) => onLoaded(e.loaded),
	})
	const contentRange = response.headers['content-range'] as string | undefined
	const total = contentRange ? Number(contentRange.split('/')[1]) || null : null
	return { status: response.status, blob: response.data, total }
}

const fetchChunkWithRetry = async (
	url: string,
	start: number,
	end: number,
	from: string | undefined,
	onLoaded: (loaded: number) => void,
): Promise<ChunkResult> => {
	let lastErr: unknown = null
	for (let attempt = 0; attempt < CHUNK_MAX_ATTEMPTS; attempt++) {
		try {
			return await fetchChunk(url, start, end, from, onLoaded)
		} catch (err) {
			lastErr = err
			// 4xx（签名过期/地址不支持）重试无意义，直接抛
			const status = (err as { response?: { status?: number } })?.response?.status
			if (status && status >= 400 && status < 500) throw err
			if (attempt < CHUNK_MAX_ATTEMPTS - 1) await sleep(500 * (attempt + 1))
		}
	}
	throw lastErr
}

/** 整拉（上游不支持 Range / 无法获知总大小时的兜底），不带超时上限，大文件慢慢下 */
const fetchWhole = async (url: string, from: string | undefined, onProgress?: MediaProgressFn) => {
	const response = await apiClient.get<Blob>('/media/proxy', {
		params: { url, from: from || undefined },
		responseType: 'blob',
		timeout: 0,
		onDownloadProgress: (e) => {
			if (onProgress && e.total) {
				onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)), e.loaded, e.total)
			}
		},
	})
	return response.data
}

/** 进度回调：percent 0-100，loaded/total 为字节数（未知时不传） */
type MediaProgressFn = (percent: number, loaded?: number, total?: number) => void

/** 经后端代理拉取媒体二进制（解决 CDN 防盗链/跨域）；from 为来源解析链接（服务端旁路缓存用） */
export const fetchMediaBlob = async (url: string, onProgress?: MediaProgressFn, from?: string) => {
	// twimg（X）国内服务器不可达，代理必然失败；其 CORS 开放（回显 Origin），浏览器直连优先，失败再试代理
	if (new URL(url).hostname.endsWith('.twimg.com')) {
		try {
			const direct = await fetch(url)
			if (direct.ok) return direct.blob()
		} catch {
			// 直连失败（无梯子/网络问题），落到后端代理再试一次
		}
	}

	// 分块断点续传：先用 1 字节探总大小（Content-Range），进度从第 0 字节起就有总量可算，
	// 不会在第一块（32MB，慢网要一分钟）期间傻显示 0%
	const probe = await fetchChunkWithRetry(url, 0, 0, from, () => {})
	// 上游不支持 Range（200 全量），或 206 但没给总大小（无法续拉，整拉兜底）
	if (probe.status !== 206) return probe.blob
	if (!probe.total) return fetchWhole(url, from, onProgress)

	const parts: Blob[] = []
	let downloaded = 0
	const total = probe.total
	const report = (chunkLoaded: number) => {
		if (onProgress && total > 0) {
			const loaded = downloaded + chunkLoaded
			onProgress(Math.min(99, Math.round((loaded / total) * 100)), loaded, total)
		}
	}

	while (downloaded < total) {
		const end = Math.min(downloaded + CHUNK_SIZE, total) - 1
		const chunk = await fetchChunkWithRetry(url, downloaded, end, from, report)
		parts.push(chunk.blob)
		downloaded += chunk.blob.size
	}
	onProgress?.(100, total, total)
	// 分块 Blob 不带 type，需从首块（带响应 Content-Type）继承，否则下游 File.type 为空
	return new Blob(parts, { type: probe.blob.type })
}
