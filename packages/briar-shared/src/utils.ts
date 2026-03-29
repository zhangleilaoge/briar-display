/**
 * 通用工具函数
 */

/**
 * 格式化日期
 */
export function formatDate(date: Date): string {
	return date.toLocaleDateString('zh-CN', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	})
}

/**
 * 延迟函数
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 生成随机 ID
 */
export function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
