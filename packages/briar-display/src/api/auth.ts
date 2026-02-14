import type { AuthSession, ApiResponse } from "@briar/shared"
import { apiClient } from "@/api/request"

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  name: string
  email: string
  password: string
}

export const setAuthToken = (token: string) => {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem("briar_token", token)
  document.cookie = `briar_token=${token}; Path=/; Max-Age=604800; SameSite=Lax`
  apiClient.defaults.headers.common.Authorization = `Bearer ${token}`
}

export const clearAuthToken = () => {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.removeItem("briar_token")
  document.cookie = "briar_token=; Path=/; Max-Age=0"
  delete apiClient.defaults.headers.common.Authorization
}

export const login = async (payload: LoginPayload) => {
  const response = await apiClient.post<ApiResponse<AuthSession>>(
    "/auth/login",
    payload,
  )
  return response.data
}

export const register = async (payload: RegisterPayload) => {
  const response = await apiClient.post<ApiResponse<AuthSession>>(
    "/auth/register",
    payload,
  )
  return response.data
}
