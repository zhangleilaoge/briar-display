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

/** 删除单条 */
export const deleteMessage = async (id: string) => {
	const response = await apiClient.delete<ApiResponse>(`/messages/${id}`)
	return response.data
}

/** 清空已读 */
export const clearReadMessages = async () => {
	const response = await apiClient.delete<ApiResponse<{ count: number }>>('/messages?scope=read')
	return response.data
}

/** 站内信变更事件（已读/删除后派发，未读角标据此立即刷新） */
export const MESSAGES_CHANGED_EVENT = 'briar:messages-changed'
export const notifyMessagesChanged = () => {
	if (typeof window !== 'undefined') window.dispatchEvent(new Event(MESSAGES_CHANGED_EVENT))
}
