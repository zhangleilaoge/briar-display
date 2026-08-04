import type { ApiResponse } from '@briar/shared'
import COS from 'cos-js-sdk-v5'
import { apiClient } from './request'

export interface FileItem {
	id: string
	userId: string
	originalName: string
	filename: string
	mimeType: string
	size: number
	width: number | null
	height: number | null
	cdnUrl: string
	thumbnailUrl: string | null
	folderId: string | null
	deletedAt: string | null
	createdAt: string
}

export interface FolderItem {
	id: string
	userId: string
	name: string
	parentId: string | null
	createdAt: string
}

export interface FileStats {
	used: number
	quota: number
	count: number
	isAdmin: boolean
}

export type FileTypeFilter = 'image' | 'video' | 'text' | 'other'

export interface UploadResult {
	name: string
	file?: FileItem
	error?: string
	deduplicated?: boolean
}

/** 超过该大小不计算内容哈希（浏览器一次性读文件进内存的限制），跳过去重 */
const HASH_MAX_SIZE = 32 * 1024 * 1024
const MAX_FILE_SIZE = 200 * 1024 * 1024

let cosInstance: COS | null = null

/** COS 实例：所有分片请求的签名由后端 /files/cos-sign 下发 */
function getCos(): COS {
	if (!cosInstance) {
		cosInstance = new COS({
			getAuthorization: async (options, callback) => {
				try {
					const res = await apiClient.post<ApiResponse<{ authorization: string }>>(
						'/files/cos-sign',
						{
							method: options.Method,
							key: options.Key,
							query: options.Query,
							headers: options.Headers,
						},
					)
					callback(res.data.data!.authorization)
				} catch (err) {
					console.error('获取 COS 签名失败:', err)
					// 返回空签名，让上传请求以 403 失败并暴露给用户
					callback('')
				}
			},
		})
	}
	return cosInstance
}

async function sha256Hex(file: File): Promise<string> {
	const buffer = await file.arrayBuffer()
	const digest = await crypto.subtle.digest('SHA-256', buffer)
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')
}

/** 浏览器对 md/txt 可能不给 MIME，按后缀补一下（影响后端类型筛选） */
function guessMimeType(file: File): string {
	if (file.type) return file.type
	const lower = file.name.toLowerCase()
	if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'text/markdown'
	if (lower.endsWith('.txt') || lower.endsWith('.log')) return 'text/plain'
	if (lower.endsWith('.json')) return 'application/json'
	if (lower.endsWith('.csv')) return 'text/csv'
	return 'application/octet-stream'
}

function sliceUpload(
	cos: COS,
	params: { Bucket: string; Region: string; Key: string; Body: File; ContentType: string },
	onProgress?: (percent: number) => void,
): Promise<void> {
	return new Promise((resolve, reject) => {
		cos.sliceUploadFile(
			{
				...params,
				ContentDisposition: 'inline',
				onProgress: (progressData) => {
					onProgress?.(Math.round(progressData.percent * 100))
				},
			},
			(err) => {
				if (err) return reject(err)
				resolve()
			},
		)
	})
}

/**
 * 直传上传：precheck → cos-js-sdk-v5 分片直传 → confirm
 * onProgress(fileName, percent) 回报每个文件的进度
 */
export const uploadFiles = async (
	files: File[],
	options?: {
		folderId?: string | null
		onProgress?: (fileName: string, percent: number) => void
	},
): Promise<UploadResult[]> => {
	const cos = getCos()
	const results: UploadResult[] = []

	for (const file of files) {
		try {
			if (file.size > MAX_FILE_SIZE) {
				results.push({
					name: file.name,
					error: `文件过大: ${(file.size / 1024 / 1024).toFixed(1)}MB (最大 200MB)`,
				})
				continue
			}

			const mimeType = guessMimeType(file)
			const fileHash = file.size <= HASH_MAX_SIZE ? await sha256Hex(file) : undefined

			// 1. precheck
			const precheck = await apiClient.post<
				ApiResponse<
					| { deduplicated: true; file: FileItem }
					| { deduplicated: false; cosKey: string; bucket: string; region: string }
				>
			>('/files/precheck', {
				name: file.name,
				size: file.size,
				mimeType,
				folderId: options?.folderId ?? null,
				fileHash,
			})
			if (!precheck.data.success || !precheck.data.data) {
				results.push({ name: file.name, error: precheck.data.message || '预检失败' })
				continue
			}
			if (precheck.data.data.deduplicated) {
				results.push({ name: file.name, file: precheck.data.data.file, deduplicated: true })
				continue
			}

			const { cosKey, bucket, region } = precheck.data.data

			// 2. 分片直传 COS
			await sliceUpload(
				cos,
				{ Bucket: bucket, Region: region, Key: cosKey, Body: file, ContentType: mimeType },
				(percent) => options?.onProgress?.(file.name, percent),
			)

			// 3. confirm 写库
			const confirm = await apiClient.post<ApiResponse<FileItem>>('/files/confirm', {
				cosKey,
				name: file.name,
				mimeType,
				folderId: options?.folderId ?? null,
				fileHash,
			})
			if (!confirm.data.success || !confirm.data.data) {
				results.push({ name: file.name, error: confirm.data.message || '确认失败' })
				continue
			}
			results.push({ name: file.name, file: confirm.data.data, deduplicated: false })
		} catch (err: any) {
			results.push({
				name: file.name,
				error: err?.response?.data?.message || err?.message || '上传失败',
			})
		}
	}

	return results
}

export const getFiles = async (params?: {
	keyword?: string
	folderId?: string | null
	type?: FileTypeFilter
	page?: number
	pageSize?: number
}) => {
	const searchParams = new URLSearchParams()
	if (params?.keyword) searchParams.set('keyword', params.keyword)
	if (params?.folderId) searchParams.set('folderId', params.folderId)
	if (params?.type) searchParams.set('type', params.type)
	if (params?.page) searchParams.set('page', String(params.page))
	if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize))
	const qs = searchParams.toString()
	const response = await apiClient.get<
		ApiResponse<{ items: FileItem[]; total: number; page: number; pageSize: number }>
	>(`/files${qs ? `?${qs}` : ''}`)
	return response.data
}

export const getFileDetail = async (id: string) => {
	const response = await apiClient.get<ApiResponse<FileItem>>(`/files/${id}`)
	return response.data
}

/** 文本内容预览（md / txt 等），返回原始文本 */
export const getFileContent = async (id: string) => {
	const response = await apiClient.get<string>(`/files/${id}/content`, {
		responseType: 'text',
	})
	return response.data
}

export const moveFile = async (id: string, folderId: string | null) => {
	const response = await apiClient.patch<ApiResponse>(`/files/${id}`, { folderId })
	return response.data
}

export const deleteFile = async (id: string) => {
	const response = await apiClient.delete<ApiResponse>(`/files/${id}`)
	return response.data
}

export const getFileStats = async () => {
	const response = await apiClient.get<ApiResponse<FileStats>>('/files/stats')
	return response.data
}

export const getFolders = async () => {
	const response = await apiClient.get<ApiResponse<FolderItem[]>>('/files/folders')
	return response.data
}

export const createFolder = async (name: string, parentId?: string | null) => {
	const response = await apiClient.post<ApiResponse<FolderItem>>('/files/folders', {
		name,
		parentId: parentId ?? null,
	})
	return response.data
}

export const renameFolder = async (id: string, name: string) => {
	const response = await apiClient.patch<ApiResponse>(`/files/folders/${id}`, { name })
	return response.data
}

export const deleteFolder = async (id: string) => {
	const response = await apiClient.delete<ApiResponse>(`/files/folders/${id}`)
	return response.data
}
