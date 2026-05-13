import { HTTP_STATUS } from '@briar/shared'
import { Hono } from 'hono'
import { certificateService } from '../services/certificateService'

const certRoutes = new Hono()

certRoutes.post('/renew', async (c) => {
	const domain = process.env.CERTIFICATE_DOMAIN || 'stardew.site'

	// 异步执行续期，避免 HTTP 超时（nginx 默认 60s）
	void certificateService.renewCertificate(domain, true)

	return c.json({
		success: true,
		message: '证书续期任务已启动，请通过 pm2 logs 查看进度',
		code: HTTP_STATUS.OK,
	})
})

export default certRoutes
