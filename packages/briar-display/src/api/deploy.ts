import type { ApiResponse } from '@briar/shared'
import { apiClient } from './request'

// ==================== 证书状态 ====================

export interface CertInfo {
	commonName: string
	issuer: string
	notBefore: string
	notAfter: string
	daysRemaining: number
}

export interface CertStatus {
	domain: string
	local: CertInfo | null
	live: CertInfo | null
}

export const getCertStatus = async () => {
	const response = await apiClient.get<ApiResponse<CertStatus>>('/cert/status')
	return response.data
}

// ==================== 证书续期 ====================

export interface CertRenewalItem {
	id: string
	domain: string
	triggerType: 'scheduled' | 'manual'
	status: 'running' | 'success' | 'skipped' | 'failed'
	message: string | null
	startedAt: string
	finishedAt: string | null
}

export const getCertRenewals = async () => {
	const response = await apiClient.get<ApiResponse<{ items: CertRenewalItem[] }>>('/cert/renewals')
	return response.data
}

export const triggerCertRenew = async () => {
	const response = await apiClient.post<ApiResponse>('/cert/renew')
	return response.data
}

// ==================== 部署记录 ====================

export interface DeployHistoryItem {
	commit: string
	ref: string
	actor: string
	status: string
	at: string
	run: string
}

export const getDeployHistory = async () => {
	const response =
		await apiClient.get<ApiResponse<{ items: DeployHistoryItem[] }>>('/deployment/history')
	return response.data
}

export interface DeployRunLogs {
	runId: string
	runStatus: string
	conclusion: string | null
	logs: string
}

export const getDeployLogs = async (runId: string) => {
	const response = await apiClient.get<ApiResponse<DeployRunLogs>>(`/deployment/${runId}/logs`)
	return response.data
}

// ==================== Nginx 部署 ====================

export interface NginxDeployResult {
	runId: number
	url: string
}

export const triggerNginxDeploy = async () => {
	const response = await apiClient.post<ApiResponse<NginxDeployResult>>('/deployment/nginx/deploy')
	return response.data
}
