import { API_BASE_PATH, API_TIMEOUT, NODE_PORT, PRIVACY_LOCKED_CODE } from '@briar/shared'
import axios from 'axios'

/** 最近一次请求的 trace-id，可用于调试 */
let lastTraceId: string | null = null

export const getLastTraceId = () => lastTraceId

/** 隐私空间解锁令牌：sessionStorage（标签页级，关闭即失效），12h 服务端有效期 */
export const PRIVACY_TOKEN_STORAGE_KEY = 'briar_files_privacy_token'
/** 隐私链路 403 时派发的全局事件（FileManagerPage 监听并弹解锁框） */
export const PRIVACY_LOCKED_EVENT = 'briar:privacy-locked'

export const getPrivacyToken = () =>
	typeof window === 'undefined' ? null : window.sessionStorage.getItem(PRIVACY_TOKEN_STORAGE_KEY)

export const setPrivacyToken = (token: string) => {
	window.sessionStorage.setItem(PRIVACY_TOKEN_STORAGE_KEY, token)
}

export const clearPrivacyToken = () => {
	window.sessionStorage.removeItem(PRIVACY_TOKEN_STORAGE_KEY)
}

/** 计算 API 基础地址（本地直连 node 端口，生产走 Nginx 代理） */
export const getApiBaseUrl = () => {
	// 允许通过环境变量强制指定 API 地址（本地调远程时用）
	const envUrl =
		typeof import.meta.env !== 'undefined' ? import.meta.env.PUBLIC_API_BASE_URL : undefined
	if (envUrl) {
		return envUrl
	}

	if (typeof window === 'undefined') {
		return `http://localhost:${NODE_PORT}${API_BASE_PATH}`
	}

	const { protocol, hostname } = window.location
	// 生产环境不带端口号，通过 Nginx 代理
	const isLocal = hostname === 'localhost' || hostname === '127.0.0.1'
	const baseUrl = isLocal ? `${protocol}//${hostname}:${NODE_PORT}` : `${protocol}//${hostname}`
	return `${baseUrl}${API_BASE_PATH}`
}

export const apiClient = axios.create({
	baseURL: getApiBaseUrl(),
	timeout: API_TIMEOUT,
})

apiClient.interceptors.request.use((config) => {
	if (typeof window !== 'undefined') {
		const token = window.localStorage.getItem('briar_token')
		if (token) {
			config.headers = config.headers || {}
			config.headers.Authorization = `Bearer ${token}`
		}
		// /files 开头的请求携带隐私空间解锁令牌（不存在则不带）
		if ((config.url || '').startsWith('/files')) {
			const privacyToken = getPrivacyToken()
			if (privacyToken) {
				config.headers = config.headers || {}
				config.headers['x-privacy-token'] = privacyToken
			}
		}
	}
	return config
})

apiClient.interceptors.response.use(
	(response) => {
		const traceId = response.headers?.['x-trace-id']
		if (traceId) {
			lastTraceId = traceId
		}
		return response
	},
	(error) => {
		// 隐私链路 403（token 缺失/过期）：清 sessionStorage 并通知页面弹解锁框
		if (
			typeof window !== 'undefined' &&
			error?.response?.status === 403 &&
			error?.response?.data?.code === PRIVACY_LOCKED_CODE
		) {
			clearPrivacyToken()
			window.dispatchEvent(new CustomEvent(PRIVACY_LOCKED_EVENT))
		}
		return Promise.reject(error)
	},
)

/** 根据 traceId 查询服务端请求日志 */
export const queryLogsByTraceId = async (traceId: string) => {
	const response = await apiClient.get(`/logs/trace/${traceId}`)
	return response.data
}
