/**
 * 通用类型定义
 */

/**
 * API 响应通用格式
 */
export interface ApiResponse<T = any> {
	success: boolean
	data?: T
	message?: string
	code?: number
}

/**
 * 分页参数
 */
export interface PaginationParams {
	page: number
	pageSize: number
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T> {
	items: T[]
	total: number
	page: number
	pageSize: number
	totalPages: number
}

/**
 * 用户信息
 */
export interface User {
	id: string
	name: string
	email: string
	avatar?: string
	createdAt: Date
}

export interface AuthSession {
	token: string
	user: User
}

/**
 * 带角色的用户信息
 */
export interface UserWithRoles extends User {
	roles: Role[]
	permissions: string[]
}

/**
 * 角色信息
 */
export interface Role {
	id: string
	name: string
	displayName: string
	description?: string
	isSystem: boolean
	createdAt: Date
}

/**
 * 权限信息
 */
export interface Permission {
	id: string
	code: string
	name: string
	description?: string
	type: 'page' | 'api'
	module: string
}

/**
 * 带权限的角色信息
 */
export interface RoleWithPermissions extends Role {
	permissions: Permission[]
}

/**
 * 站内信
 */
export interface SiteMessage {
	id: string
	userId: string
	type: string
	title: string
	content: string
	readAt: string | null
	createdAt: string
}
