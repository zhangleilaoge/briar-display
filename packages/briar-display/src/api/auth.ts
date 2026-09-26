import { apiClient } from '@/api/request'
import type { ApiResponse, AuthSession } from '@briar/shared'

export interface LoginPayload {
	email: string
	password: string
}

export interface RegisterPayload {
	name: string
	email: string
	password: string
}

export interface SendResetCodePayload {
	email: string
}

export interface ResetPasswordPayload {
	email: string
	code: string
	newPassword: string
}

export const setAuthToken = (token: string, user?: AuthSession['user'], permissions?: string[]) => {
	if (typeof window === 'undefined') {
		return
	}

	window.localStorage.setItem('briar_token', token)
	document.cookie = `briar_token=${token}; Path=/; Max-Age=604800; SameSite=Lax`
	apiClient.defaults.headers.common.Authorization = `Bearer ${token}`

	if (user) {
		window.localStorage.setItem('briar_user', JSON.stringify(user))
	}
	if (permissions) {
		window.localStorage.setItem('briar_permissions', JSON.stringify(permissions))
	}
}

export const clearAuthToken = () => {
	if (typeof window === 'undefined') {
		return
	}

	window.localStorage.removeItem('briar_token')
	window.localStorage.removeItem('briar_user')
	window.localStorage.removeItem('briar_permissions')
	document.cookie = 'briar_token=; Path=/; Max-Age=0'
	apiClient.defaults.headers.common.Authorization = undefined
}

/** 本地判断登录 token 存在且未过期（解 JWT payload 的 exp；解析失败按无效处理） */
export const isTokenUsable = () => {
	if (typeof window === 'undefined') return false
	const token = window.localStorage.getItem('briar_token')
	if (!token) return false
	try {
		const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
		return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now()
	} catch {
		return false
	}
}

export const login = async (payload: LoginPayload) => {
	const response = await apiClient.post<ApiResponse<AuthSession & { permissions: string[] }>>(
		'/auth/login',
		payload,
	)
	return response.data
}

export const register = async (payload: RegisterPayload) => {
	const response = await apiClient.post<ApiResponse<AuthSession & { permissions: string[] }>>(
		'/auth/register',
		payload,
	)
	return response.data
}

export const sendPasswordResetCode = async (payload: SendResetCodePayload) => {
	const response = await apiClient.post<ApiResponse>('/auth/send-reset-code', payload)
	return response.data
}

export const resetPassword = async (payload: ResetPasswordPayload) => {
	const response = await apiClient.post<ApiResponse<AuthSession & { permissions: string[] }>>(
		'/auth/reset-password',
		payload,
	)
	return response.data
}
