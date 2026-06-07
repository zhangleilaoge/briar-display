import type { ApiResponse } from '@briar/shared'
import { apiClient } from './request'

export interface ImageItem {
	id: string
	userId: string
	originalName: string
	filename: string
	mimeType: string
	size: number
	width: number | null
	height: number | null
	cdnUrl: string
	thumbnailUrl: string | null
	deletedAt: string | null
	createdAt: string
}

export interface ImageStats {
	used: number
	quota: number
	count: number
	isAdmin: boolean
}

export const uploadImages = async (files: File[]) => {
	const formData = new FormData()
	for (const file of files) {
		formData.append('file', file)
	}
	const response = await apiClient.post<ApiResponse<ImageItem[]>>('/images/upload', formData, {
		headers: { 'Content-Type': 'multipart/form-data' },
	})
	return response.data
}

export const getImages = async (params?: {
	keyword?: string
	page?: number
	pageSize?: number
}) => {
	const searchParams = new URLSearchParams()
	if (params?.keyword) searchParams.set('keyword', params.keyword)
	if (params?.page) searchParams.set('page', String(params.page))
	if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize))
	const qs = searchParams.toString()
	const response = await apiClient.get<
		ApiResponse<{ items: ImageItem[]; total: number; page: number; pageSize: number }>
	>(`/images${qs ? `?${qs}` : ''}`)
	return response.data
}

export const getImageDetail = async (id: string) => {
	const response = await apiClient.get<ApiResponse<ImageItem>>(`/images/${id}`)
	return response.data
}

export const deleteImage = async (id: string) => {
	const response = await apiClient.delete<ApiResponse>(`/images/${id}`)
	return response.data
}

export const getImageStats = async () => {
	const response = await apiClient.get<ApiResponse<ImageStats>>('/images/stats')
	return response.data
}
