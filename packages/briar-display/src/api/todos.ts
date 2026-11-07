import type { ApiResponse } from '@briar/shared'
import { apiClient } from './request'

export interface TodoItem {
	id: string
	title: string
	done: boolean
	doneAt: string | Date | null
	sortOrder: number
	createdAt: string | Date
	updatedAt: string | Date
}

export const listTodos = async () => {
	const response = await apiClient.get<ApiResponse<{ items: TodoItem[] }>>('/todos')
	return response.data
}

export const createTodo = async (title: string) => {
	const response = await apiClient.post<ApiResponse<TodoItem>>('/todos', { title })
	return response.data
}

export const updateTodo = async (id: string, patch: { title?: string; done?: boolean }) => {
	const response = await apiClient.patch<ApiResponse<TodoItem>>(`/todos/${id}`, patch)
	return response.data
}

export const deleteTodo = async (id: string) => {
	const response = await apiClient.delete<ApiResponse>(`/todos/${id}`)
	return response.data
}
