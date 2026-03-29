import { Hono } from 'hono'
import { authController } from '../controllers/authController'

const authRoutes = new Hono()

authRoutes.post('/login', (c) => authController.login(c))
authRoutes.post('/register', (c) => authController.register(c))
authRoutes.post('/send-reset-code', (c) => authController.sendPasswordResetCode(c))
authRoutes.post('/reset-password', (c) => authController.resetPassword(c))
export default authRoutes
