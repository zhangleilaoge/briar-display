import { apiClient } from '@/api/request'
import type { ApiResponse, User } from '@briar/shared'

export const getMe = async () => {
	const response = await apiClient.get<ApiResponse<User>>('/users/me')
	return response.data
}

export const updateMe = async (data: { name?: string; avatar?: string }) => {
	const response = await apiClient.put<ApiResponse<User>>('/users/me', data)
	return response.data
}

export const uploadAvatar = async (file: File) => {
	const formData = new FormData()
	formData.append('file', file)
	const response = await apiClient.post<ApiResponse<User>>('/users/me/avatar', formData, {
		headers: { 'Content-Type': 'multipart/form-data' },
	})
	return response.data
}

/** 读当前用户偏好；未登录或 401 时由调用方兜底 */
export const getPreference = async <T = unknown>(key: string) => {
	const response = await apiClient.get<ApiResponse<{ key: string; value: T | null }>>(
		`/users/me/preferences/${encodeURIComponent(key)}`,
	)
	return response.data
}

/** 写当前用户偏好（body 即 JSON 值） */
export const putPreference = async <T = unknown>(key: string, value: T) => {
	const response = await apiClient.put<ApiResponse<{ key: string; value: T }>>(
		`/users/me/preferences/${encodeURIComponent(key)}`,
		value,
	)
	return response.data
}
