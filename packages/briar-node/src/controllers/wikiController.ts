import type { Context } from "hono"
import { HTTP_STATUS, type ApiResponse, type User } from "@briar/shared"
import { wikiService } from "../services/wikiService"

export const wikiController = {
  /**
   * 获取已发布的文章列表（分页）
   */
  async list(c: Context) {
    try {
      const limitStr = c.req.query("limit") || "20"
      const offsetStr = c.req.query("offset") || "0"

      const limit = Math.max(
        1,
        Math.min(Number.isInteger(+limitStr) ? Math.floor(+limitStr) : 20, 100),
      )
      const offset = Math.max(
        0,
        Number.isInteger(+offsetStr) ? Math.floor(+offsetStr) : 0,
      )

      const articles = await wikiService.getPublishedList(limit, offset)

      return c.json<ApiResponse>(
        {
          success: true,
          data: articles,
          code: HTTP_STATUS.OK,
        },
        HTTP_STATUS.OK,
      )
    } catch (error) {
      console.error("Error listing wikis:", error)
      return c.json<ApiResponse>(
        {
          success: false,
          message: "Failed to list wikis",
          code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      )
    }
  },

  /**
   * 获取当前用户的所有文章（包括草稿）
   */
  async myWikis(c: Context) {
    const user = c.get("user") as User
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

    try {
      const articles = await wikiService.getUserWikis(user.id)
      return c.json<ApiResponse>(
        {
          success: true,
          data: articles,
          code: HTTP_STATUS.OK,
        },
        HTTP_STATUS.OK,
      )
    } catch (error) {
      console.error("Error getting my wikis:", error)
      return c.json<ApiResponse>(
        {
          success: false,
          message: "Failed to get wikis",
          code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      )
    }
  },

  /**
   * 按 slug 获取文章详情
   */
  async getBySlug(c: Context) {
    const slug = c.req.param("slug")

    try {
      const article = await wikiService.getBySlug(slug)

      if (!article) {
        return c.json<ApiResponse>(
          {
            success: false,
            message: "Article not found",
            code: HTTP_STATUS.NOT_FOUND,
          },
          HTTP_STATUS.NOT_FOUND,
        )
      }

      // 增加浏览次数
      await wikiService.addView(article.id)

      return c.json<ApiResponse>(
        {
          success: true,
          data: article,
          code: HTTP_STATUS.OK,
        },
        HTTP_STATUS.OK,
      )
    } catch (error) {
      console.error("Error getting wiki by slug:", error)
      return c.json<ApiResponse>(
        {
          success: false,
          message: "Failed to get wiki",
          code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      )
    }
  },

  /**
   * 按 ID 获取文章详情
   */
  async getById(c: Context) {
    const id = c.req.param("id")

    try {
      const article = await wikiService.getById(id)

      if (!article) {
        return c.json<ApiResponse>(
          {
            success: false,
            message: "Article not found",
            code: HTTP_STATUS.NOT_FOUND,
          },
          HTTP_STATUS.NOT_FOUND,
        )
      }

      return c.json<ApiResponse>(
        {
          success: true,
          data: article,
          code: HTTP_STATUS.OK,
        },
        HTTP_STATUS.OK,
      )
    } catch (error) {
      console.error("Error getting wiki by id:", error)
      return c.json<ApiResponse>(
        {
          success: false,
          message: "Failed to get wiki",
          code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      )
    }
  },

  /**
   * 创建新文章
   */
  async create(c: Context) {
    const user = c.get("user") as User
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

    try {
      const body = await c.req.json()
      const { title, content, status = "draft" } = body || {}

      if (!title || !content) {
        return c.json<ApiResponse>(
          {
            success: false,
            message: "Missing required fields",
            code: HTTP_STATUS.BAD_REQUEST,
          },
          HTTP_STATUS.BAD_REQUEST,
        )
      }

      const article = await wikiService.create({
        title,
        content,
        status: status || "draft",
        authorId: user.id,
      })

      return c.json<ApiResponse>(
        {
          success: true,
          data: article,
          code: HTTP_STATUS.CREATED,
        },
        HTTP_STATUS.CREATED,
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create wiki"
      const statusCode =
        message === "INVALID_TITLE" || message === "INVALID_CONTENT"
          ? HTTP_STATUS.BAD_REQUEST
          : HTTP_STATUS.INTERNAL_SERVER_ERROR

      return c.json<ApiResponse>(
        {
          success: false,
          message,
          code: statusCode,
        },
        statusCode,
      )
    }
  },

  /**
   * 更新文章
   */
  async update(c: Context) {
    const user = c.get("user") as User
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

    try {
      const id = c.req.param("id")
      const body = await c.req.json()

      const article = await wikiService.update(id, body, user.id)

      return c.json<ApiResponse>(
        {
          success: true,
          data: article,
          code: HTTP_STATUS.OK,
        },
        HTTP_STATUS.OK,
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update wiki"
      const statusCode =
        message === "FORBIDDEN"
          ? HTTP_STATUS.FORBIDDEN
          : message === "NOT_FOUND"
            ? HTTP_STATUS.NOT_FOUND
            : HTTP_STATUS.INTERNAL_SERVER_ERROR

      return c.json<ApiResponse>(
        {
          success: false,
          message,
          code: statusCode,
        },
        statusCode,
      )
    }
  },

  /**
   * 删除文章
   */
  async delete(c: Context) {
    const user = c.get("user") as User
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

    try {
      const id = c.req.param("id")
      const success = await wikiService.delete(id, user.id)

      if (!success) {
        return c.json<ApiResponse>(
          {
            success: false,
            message: "Failed to delete wiki",
            code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          },
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
        )
      }

      return c.json<ApiResponse>(
        {
          success: true,
          message: "Wiki deleted successfully",
          code: HTTP_STATUS.OK,
        },
        HTTP_STATUS.OK,
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete wiki"
      const statusCode =
        message === "FORBIDDEN"
          ? HTTP_STATUS.FORBIDDEN
          : message === "NOT_FOUND"
            ? HTTP_STATUS.NOT_FOUND
            : HTTP_STATUS.INTERNAL_SERVER_ERROR

      return c.json<ApiResponse>(
        {
          success: false,
          message,
          code: statusCode,
        },
        statusCode,
      )
    }
  },

  /**
   * 增加浏览次数
   */
  async addView(c: Context) {
    try {
      const id = c.req.param("id")
      await wikiService.addView(id)

      return c.json<ApiResponse>(
        {
          success: true,
          code: HTTP_STATUS.OK,
        },
        HTTP_STATUS.OK,
      )
    } catch (error) {
      console.error("Error adding view:", error)
      return c.json<ApiResponse>(
        {
          success: false,
          message: "Failed to add view",
          code: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        },
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
      )
    }
  },
}
