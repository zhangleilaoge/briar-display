import type { ApiResponse } from '@briar/shared'

export const handleError = (error: unknown): ApiResponse => {
	const message = error instanceof Error ? error.message : '请求失败'
	return { success: false, message, code: 500 }
}
