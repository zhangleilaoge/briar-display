import type { MediaItem, MediaProgress } from './toolMediaUtils'

export type MediaTaskKind = 'download' | 'add' | 'zip'
export type MediaTaskStatus = 'running' | 'success' | 'error'
export type MediaTaskItemStatus = 'pending' | 'running' | 'success' | 'error'
export type MediaTaskPhase = 'download' | 'upload'

export interface MediaTaskItem {
	id: string
	media: MediaItem
	status: MediaTaskItemStatus
	progress: MediaProgress
	phase?: MediaTaskPhase
	error?: string
}

export interface MediaTask {
	id: string
	kind: MediaTaskKind
	title: string
	status: MediaTaskStatus
	items: MediaTaskItem[]
	createdAt: number
	folderId?: string | null
	folderName?: string
	archiveName?: string
	packing?: boolean
	error?: string
}

export const createMediaTask = (
	kind: MediaTaskKind,
	items: MediaItem[],
	options: { title: string; folderId?: string | null; folderName?: string; archiveName?: string },
): MediaTask => ({
	id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
	kind,
	title: options.title,
	status: 'running',
	createdAt: Date.now(),
	folderId: options.folderId,
	folderName: options.folderName,
	archiveName: options.archiveName,
	items: items.map((media) => ({
		id: media.id,
		media,
		status: 'pending',
		progress: { percent: 0 },
	})),
})

/** 添加任务把下载、上传各占一半；已失败项视作已处理，避免批量进度倒退。 */
export const getMediaTaskPercent = (task: MediaTask) => {
	if (task.status === 'success') return 100
	if (task.packing) return 99
	if (task.items.length === 0) return 0
	const total = task.items.reduce((sum, item) => {
		if (item.status === 'success' || item.status === 'error') return sum + 100
		if (item.status === 'pending') return sum
		if (task.kind === 'add') {
			const phasePercent = Math.max(0, Math.min(100, item.progress.percent))
			return sum + (item.phase === 'upload' ? 50 + phasePercent / 2 : phasePercent / 2)
		}
		return sum + Math.max(0, Math.min(100, item.progress.percent))
	}, 0)
	return Math.round(total / task.items.length)
}

export const getMediaTaskError = (task: MediaTask) =>
	task.error || task.items.find((item) => item.error)?.error
