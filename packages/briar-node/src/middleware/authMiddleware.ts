import type { MiddlewareHandler } from "hono"
import { getCookie } from "hono/cookie"
import { HTTP_STATUS, type ApiResponse } from "@briar/shared"
import { authService } from "../services/authService"

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header("Authorization") || ""
  const tokenFromHeader = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : ""
  const tokenFromCookie = getCookie(c, "briar_token") || ""
  const token = tokenFromHeader || tokenFromCookie

  if (!token) {
    return c.json<ApiResponse>(
      {
        success: false,
        message: "Unauthorized",
        code: HTTP_STATUS.UNAUTHORIZED,
      },
      HTTP_STATUS.UNAUTHORIZED,
    )
  }

  try {
    const payload = authService.verifyToken(token)
    const user = await authService.getUserById(payload.sub)
    if (!user) {
      return c.json<ApiResponse>(
        {
          success: false,
          message: "Unauthorized",
          code: HTTP_STATUS.UNAUTHORIZED,
        },
        HTTP_STATUS.UNAUTHORIZED,
      )
    }

    c.set("user", user)
    await next()
  } catch (error) {
    return c.json<ApiResponse>(
      {
        success: false,
        message: "Unauthorized",
        code: HTTP_STATUS.UNAUTHORIZED,
      },
      HTTP_STATUS.UNAUTHORIZED,
    )
  }
}
