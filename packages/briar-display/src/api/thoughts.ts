import { apiClient } from '@/api/request'
import type { ApiResponse } from '@briar/shared'

export interface ThoughtAuthor {
	id: string
	name: string
	avatar?: string
}

export interface Thought {
	id: string
	userId: string
	body: string
	createdAt: string | Date
	updatedAt: string | Date
	likeCount: number
	likedByMe: boolean
	tags?: string[]
	author: ThoughtAuthor
}

export interface ThoughtList {
	items: Thought[]
	total: number
	page: number
	pageSize: number
}

export interface ThoughtLikeState {
	likeCount: number
	likedByMe: boolean
}

export interface ThoughtTagCount {
	tag: string
	count: number
}

export const listThoughts = async (page = 1, pageSize = 20, tag?: string | null) => {
	const response = await apiClient.get<ApiResponse<ThoughtList>>('/thoughts', {
		params: tag ? { page, pageSize, tag } : { page, pageSize },
	})
	return response.data
}

export const listThoughtTags = async () => {
	const response = await apiClient.get<ApiResponse<ThoughtTagCount[]>>('/thoughts/tags')
	return response.data
}

export const createThought = async (body: string) => {
	const response = await apiClient.post<ApiResponse<Thought>>('/thoughts', { body })
	return response.data
}

export const updateThought = async (id: string, body: string) => {
	const response = await apiClient.put<ApiResponse<Thought>>(`/thoughts/${id}`, { body })
	return response.data
}

export const deleteThought = async (id: string) => {
	const response = await apiClient.delete<ApiResponse>(`/thoughts/${id}`)
	return response.data
}

export const likeThought = async (id: string) => {
	const response = await apiClient.post<ApiResponse<ThoughtLikeState>>(`/thoughts/${id}/like`)
	return response.data
}

export const unlikeThought = async (id: string) => {
	const response = await apiClient.delete<ApiResponse<ThoughtLikeState>>(`/thoughts/${id}/like`)
	return response.data
}
