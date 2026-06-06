import { API_BASE_PATH, API_TIMEOUT, NODE_PORT } from '@briar/shared'
import axios from 'axios'

/** 最近一次请求的 trace-id，可用于调试 */
let lastTraceId: string | null = null

export const getLastTraceId = () => lastTraceId

const getApiBaseUrl = () => {
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
	}
	return config
})

apiClient.interceptors.response.use((response) => {
	const traceId = response.headers?.['x-trace-id']
	if (traceId) {
		lastTraceId = traceId
	}
	return response
})

/** 根据 traceId 查询服务端请求日志 */
export const queryLogsByTraceId = async (traceId: string) => {
	const response = await apiClient.get(`/logs/trace/${traceId}`)
	return response.data
}
