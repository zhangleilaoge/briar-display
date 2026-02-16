import type { ApiResponse } from "@briar/shared"
import { apiClient } from "@/api/request"

export interface WikiArticle {
  id: string
  title: string
  slug: string
  content: string
  summary: string | null
  authorId: string
  viewCount: number
  status: "draft" | "published"
  createdAt: Date
  updatedAt: Date
}

export interface CreateWikiPayload {
  title: string
  content: string
  status?: "draft" | "published"
}

export interface UpdateWikiPayload {
  title?: string
  content?: string
  status?: "draft" | "published"
}

export const wikiApi = {
  /**
   * 获取已发布的文章列表
   */
  async list(limit: number = 20, offset: number = 0) {
    try {
      const response = await apiClient.get<ApiResponse<WikiArticle[]>>(
        "/wiki",
        {
          params: { limit, offset },
        },
      )
      return response.data
    } catch (error) {
      return {
        success: false,
        message: "Failed to list wikis",
        code: 500,
      }
    }
  },

  /**
   * 获取当前用户的所有文章
   */
  async getMyWikis() {
    try {
      const response =
        await apiClient.get<ApiResponse<WikiArticle[]>>("/wiki/user/my")
      return response.data
    } catch (error) {
      return {
        success: false,
        message: "Failed to get my wikis",
        code: 500,
      }
    }
  },

  /**
   * 按 slug 获取文章详情
   */
  async getBySlug(slug: string) {
    try {
      const response = await apiClient.get<ApiResponse<WikiArticle>>(
        `/wiki/slug/${slug}`,
      )
      return response.data
    } catch (error) {
      return {
        success: false,
        message: "Failed to get wiki",
        code: 500,
      }
    }
  },

  /**
   * 按 ID 获取文章详情
   */
  async getById(id: string) {
    try {
      const response = await apiClient.get<ApiResponse<WikiArticle>>(
        `/wiki/${id}`,
      )
      return response.data
    } catch (error) {
      return {
        success: false,
        message: "Failed to get wiki",
        code: 500,
      }
    }
  },

  /**
   * 创建新文章
   */
  async create(payload: CreateWikiPayload) {
    try {
      const response = await apiClient.post<ApiResponse<WikiArticle>>(
        "/wiki",
        payload,
      )
      return response.data
    } catch (error) {
      return {
        success: false,
        message: "Failed to create wiki",
        code: 500,
      }
    }
  },

  /**
   * 更新文章
   */
  async update(id: string, payload: UpdateWikiPayload) {
    try {
      const response = await apiClient.put<ApiResponse<WikiArticle>>(
        `/wiki/${id}`,
        payload,
      )
      return response.data
    } catch (error) {
      return {
        success: false,
        message: "Failed to update wiki",
        code: 500,
      }
    }
  },

  /**
   * 删除文章
   */
  async delete(id: string) {
    try {
      const response = await apiClient.delete<ApiResponse>(`/wiki/${id}`)
      return response.data
    } catch (error) {
      return {
        success: false,
        message: "Failed to delete wiki",
        code: 500,
      }
    }
  },

  /**
   * 增加浏览次数
   */
  async addView(id: string) {
    try {
      const response = await apiClient.post<ApiResponse>(`/wiki/${id}/view`)
      return response.data
    } catch (error) {
      return {
        success: false,
        message: "Failed to add view",
        code: 500,
      }
    }
  },
}
