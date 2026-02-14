/**
 * 应用常量
 */

export const APP_NAME = "Briar"
export const APP_VERSION = "0.0.1"

/**
 * 端口配置
 */
export const DISPLAY_PORT = 4321
export const NODE_PORT = 3888

/**
 * Demo API 路径
 */
export const API_BASE_PATH = "/api"

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
  INTERNAL_SERVER_ERROR: 500,
} as const

/**
 * 环境变量
 */
export const ENV = {
  DEV: "development",
  PROD: "production",
  TEST: "test",
} as const
