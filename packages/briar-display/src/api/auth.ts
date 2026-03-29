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

export const setAuthToken = (token: string) => {
	if (typeof window === 'undefined') {
		return
	}

	window.localStorage.setItem('briar_token', token)
	document.cookie = `briar_token=${token}; Path=/; Max-Age=604800; SameSite=Lax`
	apiClient.defaults.headers.common.Authorization = `Bearer ${token}`
}

export const clearAuthToken = () => {
	if (typeof window === 'undefined') {
		return
	}

	window.localStorage.removeItem('briar_token')
	document.cookie = 'briar_token=; Path=/; Max-Age=0'
	apiClient.defaults.headers.common.Authorization = undefined
}

export const login = async (payload: LoginPayload) => {
	const response = await apiClient.post<ApiResponse<AuthSession>>('/auth/login', payload)
	return response.data
}

export const register = async (payload: RegisterPayload) => {
	const response = await apiClient.post<ApiResponse<AuthSession>>('/auth/register', payload)
	return response.data
}

export const sendPasswordResetCode = async (payload: SendResetCodePayload) => {
	const response = await apiClient.post<ApiResponse>('/auth/send-reset-code', payload)
	return response.data
}

export const resetPassword = async (payload: ResetPasswordPayload) => {
	const response = await apiClient.post<ApiResponse<AuthSession>>('/auth/reset-password', payload)
	return response.data
}
