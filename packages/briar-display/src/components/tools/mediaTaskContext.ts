import { createContext, useContext } from 'react'
import type { MediaTask } from './mediaTaskUtils'
import type { MediaItem } from './toolMediaUtils'

export interface MediaTaskContextValue {
	tasks: MediaTask[]
	activeItemIds: Set<string>
	zipRunning: boolean
	startDownload: (item: MediaItem) => boolean
	startAdd: (items: MediaItem[], folderId: string | null, folderName: string) => boolean
	startZip: (items: MediaItem[], archiveName: string) => boolean
	retryTask: (taskId: string) => void
	dismissTask: (taskId: string) => void
}

export const MediaTaskContext = createContext<MediaTaskContextValue | null>(null)

export function useMediaTasks() {
	const context = useContext(MediaTaskContext)
	if (!context) throw new Error('useMediaTasks 必须在 MediaTaskProvider 内使用')
	return context
}
