import type { Context } from "hono"
import { HTTP_STATUS, type ApiResponse } from "@briar/shared"
import { authService } from "../services/authService"

export const authController = {
  async register(c: Context) {
    const body = await c.req.json()
    const { name, email, password } = body || {}

    if (!name || !email || !password) {
      return c.json<ApiResponse>(
        {
          success: false,
          message: "Missing required fields",
          code: HTTP_STATUS.BAD_REQUEST,
        },
        HTTP_STATUS.BAD_REQUEST,
      )
    }

    try {
      const result = await authService.register(name, email, password)
      return c.json<ApiResponse>(
        {
          success: true,
          data: result,
          code: HTTP_STATUS.CREATED,
        },
        HTTP_STATUS.CREATED,
      )
    } catch (error) {
      const message =
        error instanceof Error && error.message === "EMAIL_EXISTS"
          ? "Email already exists"
          : "Register failed"
      return c.json<ApiResponse>(
        {
          success: false,
          message,
          code: HTTP_STATUS.BAD_REQUEST,
        },
        HTTP_STATUS.BAD_REQUEST,
      )
    }
  },

  async login(c: Context) {
    const body = await c.req.json()
    const { email, password } = body || {}

    if (!email || !password) {
      return c.json<ApiResponse>(
        {
          success: false,
          message: "Missing required fields",
          code: HTTP_STATUS.BAD_REQUEST,
        },
        HTTP_STATUS.BAD_REQUEST,
      )
    }

    try {
      const result = await authService.login(email, password)
      return c.json<ApiResponse>({
        success: true,
        data: result,
        code: HTTP_STATUS.OK,
      })
    } catch (error) {
      const message =
        error instanceof Error && error.message === "INVALID_CREDENTIALS"
          ? "Invalid credentials"
          : "Login failed"
      return c.json<ApiResponse>(
        {
          success: false,
          message,
          code: HTTP_STATUS.UNAUTHORIZED,
        },
        HTTP_STATUS.UNAUTHORIZED,
      )
    }
  },
}
