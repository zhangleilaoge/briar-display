import type { MiddlewareHandler } from "hono"
import { logger } from "hono/logger"
import { cors } from "hono/cors"
import { getCookie } from "hono/cookie"
import { isPublicPath, isAssetPath, isApiPublicPath } from "../config/routes"
import { authMiddleware } from "./authMiddleware"

/**
 * 全局日志中间件
 */
export const loggerMiddleware = (): MiddlewareHandler => logger()

/**
 * CORS 中间件配置
 */
export const corsMiddleware = (): MiddlewareHandler =>
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })

/**
 * 前端页面认证中间件
 * 检查 cookie 中的 token，未登录则重定向到登录页
 */
export const pageAuthMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const pathname = c.req.path

    // 资源文件和公开页面直接放行
    if (isAssetPath(pathname) || isPublicPath(pathname)) {
      return next()
    }

    // 检查 token
    const token = getCookie(c, "briar_token")
    if (!token) {
      return c.redirect("/login")
    }

    return next()
  }
}

/**
 * API 认证中间件包装器
 * 根据路径配置决定是否需要认证
 */
export const apiAuthMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const pathname = c.req.path

    // 公开 API 路径不需要认证
    if (isApiPublicPath(pathname)) {
      return next()
    }

    // 需要认证的路径使用 authMiddleware
    return authMiddleware(c, next)
  }
}

export { authMiddleware }
