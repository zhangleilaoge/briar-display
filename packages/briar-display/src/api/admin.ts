import type {
	ApiResponse,
	Permission,
	Role,
	RoleWithPermissions,
	UserWithRoles,
} from '@briar/shared'
import { apiClient } from './request'

// ==================== 角色管理 ====================

export const getRoles = async () => {
	const response = await apiClient.get<ApiResponse<Role[]>>('/admin/roles')
	return response.data
}

export const getRoleDetail = async (roleId: string) => {
	const response = await apiClient.get<ApiResponse<RoleWithPermissions>>(`/admin/roles/${roleId}`)
	return response.data
}

export const createRole = async (data: {
	name: string
	displayName: string
	description?: string
}) => {
	const response = await apiClient.post<ApiResponse<Role>>('/admin/roles', data)
	return response.data
}

export const updateRole = async (
	roleId: string,
	data: { displayName?: string; description?: string },
) => {
	const response = await apiClient.put<ApiResponse<Role>>(`/admin/roles/${roleId}`, data)
	return response.data
}

export const deleteRole = async (roleId: string) => {
	const response = await apiClient.delete<ApiResponse>(`/admin/roles/${roleId}`)
	return response.data
}

export const setRolePermissions = async (roleId: string, permissionIds: string[]) => {
	const response = await apiClient.put<ApiResponse>(`/admin/roles/${roleId}/permissions`, {
		permissionIds,
	})
	return response.data
}

// ==================== 权限管理 ====================

export const getPermissions = async () => {
	const response = await apiClient.get<ApiResponse<Permission[]>>('/admin/permissions')
	return response.data
}

export const createPermission = async (data: {
	code: string
	name: string
	description?: string
	type: 'page' | 'api'
	module: string
}) => {
	const response = await apiClient.post<ApiResponse<Permission>>('/admin/permissions', data)
	return response.data
}

export const updatePermission = async (
	permId: string,
	data: { name?: string; description?: string },
) => {
	const response = await apiClient.put<ApiResponse<Permission>>(
		`/admin/permissions/${permId}`,
		data,
	)
	return response.data
}

export const deletePermission = async (permId: string) => {
	const response = await apiClient.delete<ApiResponse>(`/admin/permissions/${permId}`)
	return response.data
}

// ==================== 用户角色分配 ====================

export const getUsers = async (params?: {
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
		ApiResponse<{
			items: { userId: string; userName: string; userEmail: string; roles: Role[] }[]
			total: number
			page: number
			pageSize: number
		}>
	>(`/admin/users${qs ? `?${qs}` : ''}`)
	return response.data
}

export const getUserRoles = async (userId: string) => {
	const response = await apiClient.get<ApiResponse<Role[]>>(`/admin/users/${userId}/roles`)
	return response.data
}

export const setUserRoles = async (userId: string, roleIds: string[]) => {
	const response = await apiClient.put<ApiResponse>(`/admin/users/${userId}/roles`, { roleIds })
	return response.data
}

export interface MergePreviewModule {
	name: string
	label: string
	count: number
	conflicts: string[]
	notes: string[]
}

export interface MergePreview {
	source: { id: string; name: string; email: string }
	target: { id: string; name: string; email: string }
	modules: MergePreviewModule[]
}

export interface MergeResult {
	sourceId: string
	targetId: string
	modules: { name: string; label: string; moved: number; notes: string[] }[]
}

/** 合并预览：各模块将迁移的数量与冲突（不修改数据） */
export const getMergePreview = async (sourceUserId: string, targetUserId: string) => {
	const response = await apiClient.get<ApiResponse<MergePreview>>(
		`/admin/users/${sourceUserId}/merge-preview`,
		{ params: { targetUserId } },
	)
	return response.data
}

/** 合并用户（仅超级管理员）：把 sourceUserId 的数据迁到 targetUserId 后删除 sourceUserId */
export const mergeUser = async (sourceUserId: string, targetUserId: string) => {
	const response = await apiClient.post<ApiResponse<MergeResult>>(
		`/admin/users/${sourceUserId}/merge`,
		{ targetUserId },
	)
	return response.data
}

export interface UserMergeLog {
	id: string
	operatorId?: string
	operatorName: string
	sourceUserId: string
	sourceName: string
	sourceEmail: string
	targetUserId: string
	targetName: string
	targetEmail: string
	modules: { name: string; label: string; moved: number; notes: string[] }[]
	conflicts: { module: string; label: string; message: string }[]
	status: 'success' | 'failed'
	error: string | null
	startedAt: string
	finishedAt: string
}

/** 用户合并记录（仅超级管理员） */
export const getUserMergeLogs = async (q: {
	limit: number
	offset: number
	status?: 'success' | 'failed'
}) => {
	const response = await apiClient.get<ApiResponse<{ items: UserMergeLog[]; total: number }>>(
		'/admin/user-merge-logs',
		{ params: q },
	)
	return response.data
}

// ==================== 当前用户权限 ====================

export const getMyPermissions = async () => {
	const response = await apiClient.get<ApiResponse<UserWithRoles>>('/admin/me/permissions')
	return response.data
}

// ==================== 请求日志 ====================

export interface RequestLogItem {
	id: string
	traceId: string
	method: string
	path: string
	status: number
	duration: number
	ip: string | null
	userAgent: string | null
	userId: string | null
	requestParams: Record<string, unknown> | null
	responseBody: string | null
	errorMessage: string | null
	errorStack: string | null
	createdAt: string
}

export const getLogs = async (params?: {
	method?: string
	path?: string
	statusGroup?: string
	traceId?: string
	userId?: string
	keyword?: string
	startTime?: string
	endTime?: string
	limit?: number
	offset?: number
}) => {
	const searchParams = new URLSearchParams()
	if (params?.method) searchParams.set('method', params.method)
	if (params?.path) searchParams.set('path', params.path)
	if (params?.statusGroup) searchParams.set('statusGroup', params.statusGroup)
	if (params?.traceId) searchParams.set('traceId', params.traceId)
	if (params?.userId) searchParams.set('userId', params.userId)
	if (params?.keyword) searchParams.set('keyword', params.keyword)
	if (params?.startTime) searchParams.set('startTime', params.startTime)
	if (params?.endTime) searchParams.set('endTime', params.endTime)
	if (params?.limit) searchParams.set('limit', String(params.limit))
	if (params?.offset) searchParams.set('offset', String(params.offset))
	const qs = searchParams.toString()
	const response = await apiClient.get<ApiResponse<{ items: RequestLogItem[]; total: number }>>(
		`/admin/logs${qs ? `?${qs}` : ''}`,
	)
	return response.data
}

export const getLogStats = async () => {
	const response =
		await apiClient.get<
			ApiResponse<{
				todayTotal: number
				todayErrors: number
				avgDuration: number
				slowCount: number
			}>
		>('/admin/logs/stats')
	return response.data
}
