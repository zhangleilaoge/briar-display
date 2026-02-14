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
  createdAt: Date
}

/**
 * Auth session payload
 */
export interface AuthSession {
  token: string
  user: User
}
