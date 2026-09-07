import type { ApiResponse } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import { generateId } from '@briar/shared'
import { Hono } from 'hono'
import { fileDal } from '../dal/fileDal'
import { getExtFromName, resolveMimeType } from '../lib/fileMime'
import { cosService } from '../services/cosService'
import { privacyService } from '../services/privacyService'
import { guardPrivateChain, hasPrivacyUnlock } from './filePrivacy'
import { MAX_FILE_SIZE, getQuota, requireUser, unauthorized, validateFolder } from './filesShared'

const fileUploadRoutes = new Hono()

/** POST /precheck — 直传前校验（配额/大小/文件夹/去重），分配 cosKey */
fileUploadRoutes.post('/precheck', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)

	const body = await c.req.json<{
		name?: string
		size?: number
		mimeType?: string
		folderId?: string | null
		fileHash?: string
	}>()

	const name = (body.name || '').trim()
	const size = Number(body.size) || 0
	const mimeType = body.mimeType || 'application/octet-stream'

	if (!name) {
		return c.json<ApiResponse>(
			{ success: false, message: '文件名不能为空' },
			HTTP_STATUS.BAD_REQUEST,
		)
	}
	if (size <= 0) {
		return c.json<ApiResponse>({ success: false, message: '文件大小无效' }, HTTP_STATUS.BAD_REQUEST)
	}
	if (size > MAX_FILE_SIZE) {
		return c.json<ApiResponse>(
			{
				success: false,
				message: `文件过大: ${(size / 1024 / 1024).toFixed(1)}MB (最大 200MB)`,
			},
			HTTP_STATUS.PAYLOAD_TOO_LARGE,
		)
	}

	const folder = await validateFolder(user.id, body.folderId)
	if (folder === undefined) {
		return c.json<ApiResponse>({ success: false, message: '文件夹不存在' }, HTTP_STATUS.BAD_REQUEST)
	}

	// 目标文件夹在隐私链路需先解锁
	const denied = await guardPrivateChain(c, user.id, folder?.id)
	if (denied) return denied

	// 内容去重（仅当客户端提供了 hash）
	if (body.fileHash) {
		const existing = await fileDal.findByUserAndHash(user.id, body.fileHash)
		if (existing) {
			// 命中隐私链路文件且未解锁：跳过去重按新文件上传，避免泄露文件存在性与签名 URL
			const existingPrivate =
				existing.folderId &&
				(await privacyService.isPrivateChain(user.id, existing.folderId)) &&
				!hasPrivacyUnlock(c, user.id)
			if (!existingPrivate) {
				return c.json<ApiResponse>({
					success: true,
					data: {
						deduplicated: true,
						file: { ...existing, ...cosService.signFileUrls(existing) },
					},
				})
			}
		}
	}

	// 配额校验
	const { quota, isAdmin } = await getQuota(user.id)
	const used = Number(await fileDal.getUserStorageUsed(user.id)) || 0
	if (used + size > quota) {
		console.warn('[Upload Quota]', { userId: user.id, used, newSize: size, quota, isAdmin, name })
		return c.json<ApiResponse>(
			{
				success: false,
				message: `存储空间不足。已用 ${(used / 1024 / 1024).toFixed(1)}MB，限额 ${isAdmin ? 2048 : 200}MB`,
			},
			HTTP_STATUS.PAYLOAD_TOO_LARGE,
		)
	}

	const cosKey = `files/${user.id}/${generateId()}${getExtFromName(name)}`
	const { bucket, region } = cosService.getBucketInfo()

	return c.json<ApiResponse>({
		success: true,
		data: { deduplicated: false, cosKey, bucket, region },
	})
})

/** POST /cos-sign — 为前端 cos-js-sdk-v5 的分片请求签名 */
fileUploadRoutes.post('/cos-sign', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)

	const body = await c.req.json<{
		method?: string
		key?: string
		query?: Record<string, string>
		headers?: Record<string, string>
	}>()

	const method = (body.method || '').toUpperCase()
	const key = body.key || ''

	if (!method) {
		return c.json<ApiResponse>({ success: false, message: '参数不完整' }, HTTP_STATUS.BAD_REQUEST)
	}

	// 只允许签名当前用户自己的 files/{userId}/ 前缀。
	// key 为空时是 bucket 级请求（sliceUploadFile 续传检查：GET /?prefix=xxx&uploads），
	// 此时校验 query.prefix 前缀。
	const userPrefix = `files/${user.id}/`
	if (key) {
		if (!key.startsWith(userPrefix)) {
			return c.json<ApiResponse>(
				{ success: false, message: '无权操作该对象' },
				HTTP_STATUS.FORBIDDEN,
			)
		}
	} else if (!(body.query?.prefix || '').startsWith(userPrefix)) {
		return c.json<ApiResponse>({ success: false, message: '无权操作该对象' }, HTTP_STATUS.FORBIDDEN)
	}

	const authorization = cosService.getAuth({
		Method: method,
		Key: key,
		Query: body.query,
		Headers: body.headers,
	})

	return c.json<ApiResponse>({ success: true, data: { authorization } })
})

/** POST /confirm — 直传完成后写库 */
fileUploadRoutes.post('/confirm', async (c) => {
	const user = requireUser(c)
	if (!user) return unauthorized(c)

	const body = await c.req.json<{
		cosKey?: string
		name?: string
		mimeType?: string
		folderId?: string | null
		fileHash?: string
		thumbnailKey?: string
	}>()

	const cosKey = body.cosKey || ''
	const name = (body.name || '').trim()
	if (!cosKey.startsWith(`files/${user.id}/`) || !name) {
		return c.json<ApiResponse>({ success: false, message: '参数不完整' }, HTTP_STATUS.BAD_REQUEST)
	}

	// 封面图 key（视频客户端截帧），同样限制在当前用户前缀下
	const thumbnailKey = body.thumbnailKey?.startsWith(`files/${user.id}/`)
		? body.thumbnailKey
		: undefined

	const folder = await validateFolder(user.id, body.folderId)
	if (folder === undefined) {
		return c.json<ApiResponse>({ success: false, message: '文件夹不存在' }, HTTP_STATUS.BAD_REQUEST)
	}

	// 目标文件夹在隐私链路需先解锁
	const denied = await guardPrivateChain(c, user.id, folder?.id)
	if (denied) return denied

	// 以 COS 上的实际对象为准
	let actualSize: number
	try {
		actualSize = await cosService.headObject(cosKey)
	} catch {
		return c.json<ApiResponse>(
			{ success: false, message: '文件尚未上传成功' },
			HTTP_STATUS.BAD_REQUEST,
		)
	}

	const { quota, isAdmin } = await getQuota(user.id)
	const used = Number(await fileDal.getUserStorageUsed(user.id)) || 0
	if (used + actualSize > quota) {
		// 清理已上传的对象
		try {
			await cosService.deleteObject(cosKey)
		} catch {
			/* best effort */
		}
		return c.json<ApiResponse>(
			{
				success: false,
				message: `存储空间不足。已用 ${(used / 1024 / 1024).toFixed(1)}MB，限额 ${isAdmin ? 2048 : 200}MB`,
			},
			HTTP_STATUS.PAYLOAD_TOO_LARGE,
		)
	}

	const mimeType = resolveMimeType(name, body.mimeType)
	const cdnUrl = cosService.getPublicUrl(cosKey)
	const thumbnailUrl = mimeType.startsWith('image/')
		? cosService.getThumbnailUrl(cdnUrl)
		: thumbnailKey
			? cosService.getPublicUrl(thumbnailKey)
			: undefined

	const record = await fileDal.create({
		userId: user.id,
		originalName: name,
		filename: cosKey,
		mimeType,
		size: actualSize,
		cdnUrl,
		thumbnailUrl,
		fileHash: body.fileHash,
		folderId: folder?.id ?? null,
	})

	return c.json<ApiResponse>({
		success: true,
		data: { ...record, ...cosService.signFileUrls(record) },
	})
})

export default fileUploadRoutes
