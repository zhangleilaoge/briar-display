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

/** 经后端代理拉取媒体二进制（解决 CDN 防盗链/跨域） */
export const fetchMediaBlob = async (url: string, onProgress?: (percent: number) => void) => {
	const response = await apiClient.get<Blob>('/media/proxy', {
		params: { url },
		responseType: 'blob',
		timeout: 300_000,
		onDownloadProgress: (e) => {
			if (onProgress && e.total) {
				onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)))
			}
		},
	})
	return response.data
}
