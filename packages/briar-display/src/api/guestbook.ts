import type { ApiResponse } from '@briar/shared'
import { apiClient } from './request'

export interface GuestbookEntry {
	id: string
	nickname: string
	content: string
	status: 'pending' | 'approved' | 'rejected'
	createdAt: string | Date
	reviewedAt?: string | Date | null
	ip?: string | null
}

export interface GuestbookList {
	items: GuestbookEntry[]
	total: number
	page: number
	pageSize: number
}

export const listGuestbook = async (page = 1, pageSize = 20) => {
	const response = await apiClient.get<ApiResponse<GuestbookList>>('/guestbook', {
		params: { page, pageSize },
	})
	return response.data
}

export const listGuestbookPending = async (page = 1, pageSize = 20) => {
	const response = await apiClient.get<ApiResponse<GuestbookList>>('/guestbook/pending', {
		params: { page, pageSize },
	})
	return response.data
}

export const submitGuestbook = async (nickname: string, content: string) => {
	const response = await apiClient.post<ApiResponse<{ id: string }>>('/guestbook/submit', {
		nickname,
		content,
	})
	return response.data
}

export const approveGuestbook = async (id: string) => {
	const response = await apiClient.post<ApiResponse<GuestbookEntry>>(`/guestbook/${id}/approve`)
	return response.data
}

export const rejectGuestbook = async (id: string) => {
	const response = await apiClient.post<ApiResponse>(`/guestbook/${id}/reject`)
	return response.data
}

export const deleteGuestbook = async (id: string) => {
	const response = await apiClient.delete<ApiResponse>(`/guestbook/${id}`)
	return response.data
}
