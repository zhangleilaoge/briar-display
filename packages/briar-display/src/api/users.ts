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
