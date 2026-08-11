import { HTTP_STATUS, PERMISSIONS } from '@briar/shared'
import { Hono } from 'hono'
import { certRenewalDal } from '../dal/certRenewalDal'
import { requirePermission } from '../middleware/permissionMiddleware'
import { certificateService } from '../services/certificateService'

const certRoutes = new Hono()

const resolveDomain = () => process.env.CERTIFICATE_DOMAIN || 'xiaobuzi.cn'

/**
 * 证书状态：本地证书文件 + 线上实际服役证书
 */
certRoutes.get('/status', requirePermission(PERMISSIONS.ADMIN_DEPLOY_MANAGE), async (c) => {
	const domain = resolveDomain()
	const [local, live] = await Promise.all([
		certificateService.getLocalCertificateInfo(domain),
		certificateService.getLiveCertificateInfo(domain),
	])

	return c.json({
		success: true,
		data: { domain, local, live },
		code: HTTP_STATUS.OK,
	})
})

/**
 * 续期记录（倒序）
 */
certRoutes.get('/renewals', requirePermission(PERMISSIONS.ADMIN_DEPLOY_MANAGE), async (c) => {
	const items = await certRenewalDal.list(20)
	return c.json({
		success: true,
		data: { items },
		code: HTTP_STATUS.OK,
	})
})

/**
 * 手动触发强制续期
 */
certRoutes.post('/renew', requirePermission(PERMISSIONS.ADMIN_DEPLOY_MANAGE), async (c) => {
	const domain = resolveDomain()

	// 异步执行续期，避免 HTTP 超时（nginx 默认 60s）
	void certificateService.renewCertificate(domain, true, 'manual')

	return c.json({
		success: true,
		message: '证书续期任务已启动，请稍后在续期记录中查看结果',
		code: HTTP_STATUS.OK,
	})
})

export default certRoutes
