import type { ApiResponse } from '@briar/shared'
import { HTTP_STATUS } from '@briar/shared'
import type { Context } from 'hono'
import { folderDal } from '../dal/folderDal'
import { cosService } from '../services/cosService'
import { permissionService } from '../services/permissionService'

export const MAX_FILE_SIZE = 200 * 1024 * 1024 // 200MB
export const USER_QUOTA = 200 * 1024 * 1024 // 200MB
export const ADMIN_QUOTA = 2 * 1024 * 1024 * 1024 // 2GB

export type AuthedUser = { id: string }

export function requireUser(c: Context): AuthedUser | null {
	return (c.get('user') as AuthedUser | undefined) ?? null
}

export function unauthorized(c: Context) {
	return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
}

/** 校验文件夹归属当前用户，返回文件夹或 null（根目录） */
export async function validateFolder(userId: string, folderId?: string | null) {
	if (!folderId) return null
	const folder = await folderDal.findById(folderId)
	if (!folder || folder.userId !== userId) return undefined
	return folder
}

export async function getQuota(userId: string) {
	const isAdmin = await permissionService.isAdmin(userId)
	return { quota: isAdmin ? ADMIN_QUOTA : USER_QUOTA, isAdmin }
}

/** 删除 COS 对象（视频会连带封面图，best effort） */
export async function deleteCosObjects(file: { filename: string; mimeType: string }) {
	await cosService.deleteFileWithCover(file.filename, file.mimeType)
}
