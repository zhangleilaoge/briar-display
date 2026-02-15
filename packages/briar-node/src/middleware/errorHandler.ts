import type { Context, MiddlewareHandler } from "hono"
import { HTTPException } from "hono/http-exception"
import { HTTP_STATUS, type ApiResponse } from "@briar/shared"

/**
 * 全局错误处理中间件
 * 捕获所有未处理的错误并返回统一格式的 JSON 响应
 */
export const errorHandler = (): MiddlewareHandler => {
  return async (c: Context, next) => {
    try {
      await next()
    } catch (error) {
      console.error("🔴 Unhandled error:", error)

      // 处理 Hono HTTPException
      if (error instanceof HTTPException) {
        return c.json<ApiResponse>(
          {
            success: false,
            message: error.message,
            code: error.status,
          },
          error.status,
        )
      }

      // 处理标准 Error
      if (error instanceof Error) {
        const isDev = process.env.NODE_ENV !== "production"
        return c.json<ApiResponse>(
          {
            success: false,
            message: error.message,
            code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
            ...(isDev && { stack: error.stack }),
          },
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
        )
      }

      // 处理未知错误
      return c.json<ApiResponse>(
        {
          success: false,
          message: "Internal server error",
          code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      )
    }
  }
}
