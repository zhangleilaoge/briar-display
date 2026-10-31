import type { ApiResponse } from '@briar/shared'
import { apiClient } from './request'

export interface VersionFingerprint {
	commit: string
	/** 最后一次影响部署产物的源码提交；旧版本指纹没有此字段 */
	sourceCommit?: string
	branch: string
	dirty: boolean
	builtAt: string
	builder: string
}

export interface SiteVersion {
	backend: VersionFingerprint | null
	frontend: VersionFingerprint | null
	startedAt: string
}

export const getSiteVersion = async () => {
	const response = await apiClient.get<ApiResponse<SiteVersion>>('/version')
	return response.data
}
