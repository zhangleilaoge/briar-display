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

/** 经后端代理拉取媒体二进制（解决 CDN 防盗链/跨域）；from 为来源解析链接（服务端旁路缓存用） */
export const fetchMediaBlob = async (
	url: string,
	onProgress?: (percent: number) => void,
	from?: string,
) => {
	// twimg（X）国内服务器不可达，代理必然失败；其 CORS 开放（回显 Origin），浏览器直连优先，失败再试代理
	if (new URL(url).hostname.endsWith('.twimg.com')) {
		try {
			const direct = await fetch(url)
			if (direct.ok) return direct.blob()
		} catch {
			// 直连失败（无梯子/网络问题），落到后端代理再试一次
		}
	}
	const response = await apiClient.get<Blob>('/media/proxy', {
		params: { url, from: from || undefined },
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
