import { Hono } from "hono"
import { apiAuthMiddleware } from "../middleware"
import authRoutes from "./auth"

const api = new Hono()

// 应用统一的 API 认证中间件（内部会基于路径配置进行匹配）
api.use("*", apiAuthMiddleware())

// 注册路由
api.route("/auth", authRoutes)

// 在此添加其他 API 路由...
// api.route("/users", userRoutes)
// api.route("/posts", postRoutes)

export default api
