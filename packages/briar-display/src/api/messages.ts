import type { ApiResponse, SiteMessage } from '@briar/shared'
import { apiClient } from './request'

export interface MessageListResult {
	items: SiteMessage[]
	total: number
	page: number
	pageSize: number
}

/** 站内信列表（分页） */
export const getMessages = async (page = 1, pageSize = 10) => {
	const response = await apiClient.get<ApiResponse<MessageListResult>>(
		`/messages?page=${page}&pageSize=${pageSize}`,
	)
	return response.data
}

/** 未读数 */
export const getUnreadCount = async () => {
	const response = await apiClient.get<ApiResponse<{ count: number }>>('/messages/unread-count')
	return response.data
}

/** 标记单条已读 */
export const markMessageRead = async (id: string) => {
	const response = await apiClient.post<ApiResponse>(`/messages/${id}/read`)
	return response.data
}

/** 全部标记已读 */
export const markAllMessagesRead = async () => {
	const response = await apiClient.post<ApiResponse<{ count: number }>>('/messages/read-all')
	return response.data
}
