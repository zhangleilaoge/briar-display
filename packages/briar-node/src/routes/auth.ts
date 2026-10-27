import { Hono } from 'hono'
import { authController } from '../controllers/authController'

const authRoutes = new Hono()

authRoutes.post('/login', (c) => authController.login(c))
authRoutes.post('/register', (c) => authController.register(c))
authRoutes.post('/send-reset-code', (c) => authController.sendPasswordResetCode(c))
authRoutes.post('/reset-password', (c) => authController.resetPassword(c))
// Google Identity Services：前端拿 ID Token，后端本地验签（服务器无需访问 Google）
authRoutes.post('/google/id-token', (c) => authController.googleIdToken(c))

export default authRoutes
