import { HTTP_STATUS } from '@briar/shared'
import { Hono } from 'hono'
import { certificateService } from '../services/certificateService'

const certRoutes = new Hono()

certRoutes.post('/renew', async (c) => {
	const domain = process.env.CERTIFICATE_DOMAIN || 'stardew.site'
	const result = await certificateService.renewCertificate(domain, true)
	return c.json(result, result.success ? HTTP_STATUS.OK : HTTP_STATUS.INTERNAL_SERVER_ERROR)
})

export default certRoutes
