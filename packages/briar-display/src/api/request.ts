import { API_BASE_PATH, API_TIMEOUT, NODE_PORT } from '@briar/shared'
import axios from 'axios'

const getApiBaseUrl = () => {
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
