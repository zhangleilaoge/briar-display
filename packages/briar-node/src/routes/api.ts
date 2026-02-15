import { Hono } from "hono"
import authRoutes from "./auth"

const api = new Hono()

// 注册路由
api.route("/auth", authRoutes)

// 在此添加其他 API 路由...
// api.route("/users", userRoutes)
// api.route("/posts", postRoutes)

export default api
