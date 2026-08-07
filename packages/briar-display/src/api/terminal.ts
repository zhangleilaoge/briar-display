import type { ApiResponse } from '@briar/shared'
import { apiClient } from './request'

const DEVICE_TOKEN_KEY = 'briar_terminal_device'

export interface HostInfo {
	hostname: string
	os: string
	cpuModel: string
	cpuCores: number
	uptime: string
	load: [number, number, number]
	mem: { totalMb: number; usedMb: number; availableMb: number }
	disk: { size: string; used: string; avail: string; usePercent: number; mount: string }
	collectedAt: string
}

/** 设备令牌（邮箱验证码换取，7 天有效，存本机 localStorage） */
export const getDeviceToken = (): string => {
	if (typeof window === 'undefined') return ''
	return window.localStorage.getItem(DEVICE_TOKEN_KEY) || ''
}

export const saveDeviceToken = (token: string) => {
	window.localStorage.setItem(DEVICE_TOKEN_KEY, token)
}

export const clearDeviceToken = () => {
	window.localStorage.removeItem(DEVICE_TOKEN_KEY)
}

/** 本机设备令牌是否存在且未过期（服务端仍会强校验，这里仅决定 UI 门槛） */
export const isDeviceAuthorized = (): boolean => {
	const token = getDeviceToken()
	if (!token) return false
	try {
		const payload = JSON.parse(atob(token.split('.')[1] || ''))
		return payload.purpose === 'terminal-device' && Number(payload.exp) * 1000 > Date.now()
	} catch {
		return false
	}
}

/** 设备令牌过期时间（用于界面展示） */
export const getDeviceTokenExpiry = (): Date | null => {
	const token = getDeviceToken()
	if (!token) return null
	try {
		const payload = JSON.parse(atob(token.split('.')[1] || ''))
		return payload.exp ? new Date(Number(payload.exp) * 1000) : null
	} catch {
		return null
	}
}

/** 发送 SSH 控制台验证码到当前用户邮箱 */
export const sendTerminalCode = async () => {
	const response = await apiClient.post<ApiResponse>('/terminal/verification-code')
	return response.data
}

/** 校验验证码，换取 7 天设备令牌 */
export const verifyTerminalDevice = async (code: string) => {
	const response = await apiClient.post<ApiResponse<{ token: string; expiresAt: string }>>(
		'/terminal/verify-device',
		{ code },
	)
	return response.data
}

/** 服务器信息（内存/CPU/硬盘/系统） */
export const getHostInfo = async () => {
	const response = await apiClient.get<ApiResponse<HostInfo>>('/terminal/host-info', {
		headers: { 'x-terminal-device': getDeviceToken() },
	})
	return response.data
}
