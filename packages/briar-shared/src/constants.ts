/**
 * 应用常量
 */

export const APP_NAME = 'Briar'
export const APP_VERSION = '0.0.1'

/**
 * 端口配置
 */
export const DISPLAY_PORT = 4321
export const NODE_PORT = 3888

/**
 * Demo API 路径
 */
export const API_BASE_PATH = '/api'

/**
 * API 相关常量
 */
export const API_TIMEOUT = 30000
export const API_RETRY_TIMES = 3

/**
 * 状态码
 */
export const HTTP_STATUS = {
	OK: 200,
	CREATED: 201,
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	CONFLICT: 409,
	PAYLOAD_TOO_LARGE: 413,
	TOO_MANY_REQUESTS: 429,
	INTERNAL_SERVER_ERROR: 500,
} as const

/**
 * 隐私空间未解锁的业务错误码（HTTP 403 响应体 code 字段，前端据此清 token 并弹解锁框）
 */
export const PRIVACY_LOCKED_CODE = 40301

/**
 * 环境变量
 */
export const ENV = {
	DEV: 'development',
	PROD: 'production',
	TEST: 'test',
} as const
