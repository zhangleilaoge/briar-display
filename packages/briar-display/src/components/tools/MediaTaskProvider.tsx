'use client'

import { uploadFiles } from '@/api/files'
import { fetchMediaBlob } from '@/api/media'
import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import MediaTaskCenter from './MediaTaskCenter'
import { MediaTaskContext } from './mediaTaskContext'
import {
	type MediaTask,
	type MediaTaskItem,
	createMediaTask,
	getMediaTaskError,
} from './mediaTaskUtils'
import { createZip, saveBlob } from './toolMediaUtils'

const errorMessage = (error: unknown, fallback: string) => {
	const err = error as { response?: { data?: { message?: string } }; message?: string }
	return err?.response?.data?.message || err?.message || fallback
}

export function MediaTaskProvider({ children }: { children: ReactNode }) {
	const [tasks, setTasks] = useState<MediaTask[]>([])
	const tasksRef = useRef(tasks)
	tasksRef.current = tasks
	const activeItemsRef = useRef(new Set<string>())
	const zipRunningRef = useRef(false)

	const patchTask = useCallback((taskId: string, updater: (task: MediaTask) => MediaTask) => {
		setTasks((current) => current.map((task) => (task.id === taskId ? updater(task) : task)))
	}, [])

	const patchItem = useCallback(
		(taskId: string, itemId: string, updater: (item: MediaTaskItem) => MediaTaskItem) => {
			patchTask(taskId, (task) => ({
				...task,
				items: task.items.map((item) => (item.id === itemId ? updater(item) : item)),
			}))
		},
		[patchTask],
	)

	const executeTask = useCallback(
		async (task: MediaTask, onlyFailed = false) => {
			const workItems =
				onlyFailed && task.kind === 'add'
					? task.items.filter((item) => item.status === 'error')
					: task.items
			const workIds = new Set(workItems.map((item) => item.id))
			const outcomes = new Map<string, MediaTaskItem>(
				task.items.map((item) => [
					item.id,
					workIds.has(item.id)
						? {
								...item,
								status: 'pending',
								progress: { percent: 0 },
								phase: undefined,
								error: undefined,
							}
						: item,
				]),
			)

			patchTask(task.id, (current) => ({
				...current,
				status: 'running',
				packing: false,
				error: undefined,
				items: current.items.map((item) => outcomes.get(item.id) ?? item),
			}))

			const updateItem = (next: MediaTaskItem) => {
				outcomes.set(next.id, next)
				patchItem(task.id, next.id, () => next)
			}

			const loadItem = async (taskItem: MediaTaskItem) => {
				let progress: { percent: number; loaded?: number; total?: number } = { percent: 0 }
				updateItem({
					...taskItem,
					status: 'running',
					phase: 'download',
					progress,
					error: undefined,
				})
				try {
					const blob = await fetchMediaBlob(
						taskItem.media.url,
						(percent, loaded, total) => {
							progress = { percent, loaded, total }
							patchItem(task.id, taskItem.id, (item) => ({ ...item, progress }))
						},
						taskItem.media.sourceUrl,
					)
					return blob
				} catch (error) {
					updateItem({
						...outcomes.get(taskItem.id)!,
						status: 'error',
						phase: 'download',
						progress,
						error: errorMessage(error, `${taskItem.media.label} 下载失败`),
					})
					throw error
				}
			}

			let taskError: string | undefined
			try {
				if (task.kind === 'download') {
					const taskItem = task.items[0]
					const blob = await loadItem(taskItem)
					saveBlob(blob, taskItem.media.filename)
					updateItem({
						...outcomes.get(taskItem.id)!,
						status: 'success',
						progress: { percent: 100 },
						error: undefined,
					})
				} else if (task.kind === 'add') {
					for (const original of workItems) {
						const taskItem = outcomes.get(original.id)!
						let blob: Blob
						try {
							blob = await loadItem(taskItem)
						} catch {
							continue
						}
						try {
							updateItem({
								...outcomes.get(taskItem.id)!,
								status: 'running',
								phase: 'upload',
								progress: { percent: 0 },
							})
							const file = new File([blob], taskItem.media.filename, {
								type: blob.type || undefined,
							})
							const results = await uploadFiles([file], {
								folderId: task.folderId,
								onProgress: (_fileName, percent) => {
									patchItem(task.id, taskItem.id, (item) => ({
										...item,
										phase: 'upload',
										progress: { percent },
									}))
								},
							})
							if (results[0]?.error) throw new Error(results[0].error)
							if (results[0]?.deduplicated) throw new Error('相同文件已存在，未重复添加')
							if (!results[0]) throw new Error('上传失败')
							updateItem({
								...outcomes.get(taskItem.id)!,
								status: 'success',
								phase: 'upload',
								progress: { percent: 100 },
								error: undefined,
							})
						} catch (error) {
							updateItem({
								...outcomes.get(taskItem.id)!,
								status: 'error',
								phase: 'upload',
								error: errorMessage(error, `${taskItem.media.label} 添加失败`),
							})
						}
					}
				} else {
					const entries: { name: string; data: Uint8Array }[] = []
					for (const original of workItems) {
						const taskItem = outcomes.get(original.id)!
						const blob = await loadItem(taskItem)
						const data = new Uint8Array(await blob.arrayBuffer())
						entries.push({ name: taskItem.media.filename, data })
						updateItem({
							...outcomes.get(taskItem.id)!,
							status: 'success',
							progress: { percent: 100 },
							error: undefined,
						})
					}
					patchTask(task.id, (current) => ({ ...current, packing: true }))
					await new Promise<void>((resolve) => setTimeout(resolve, 0))
					const zip = createZip(entries)
					saveBlob(zip, task.archiveName || 'media.zip')
				}
			} catch (error) {
				taskError = errorMessage(error, `${task.title}失败`)
			}

			const finalItems = task.items.map((item) => outcomes.get(item.id) ?? item)
			const failed = finalItems.filter((item) => item.status === 'error').length
			const succeeded = finalItems.filter((item) => item.status === 'success').length
			const finalError = taskError || (failed > 0 ? '部分项目未完成' : undefined)
			patchTask(task.id, (current) => ({
				...current,
				status: finalError ? 'error' : 'success',
				items: finalItems,
				packing: false,
				error: taskError,
			}))
			for (const item of workItems) activeItemsRef.current.delete(item.id)
			if (task.kind === 'zip') zipRunningRef.current = false

			if (task.kind === 'download') {
				if (finalError)
					toast.error(getMediaTaskError({ ...task, items: finalItems, error: taskError }))
				else toast.success(`${task.items[0].media.label} 下载完成`)
			} else if (task.kind === 'add') {
				if (failed === 0) {
					toast.success(`已添加 ${succeeded} 个文件到「${task.folderName}」`)
				} else {
					const duplicated = finalItems.filter((item) =>
						item.error?.includes('相同文件已存在'),
					).length
					const prefix = succeeded > 0 ? `已添加 ${succeeded} 个文件，` : ''
					const detail =
						duplicated > 0
							? `${duplicated} 个相同文件已存在，未重复添加${
									failed > duplicated ? `，另有 ${failed - duplicated} 个添加失败` : ''
								}`
							: `${failed} 个文件添加失败`
					toast.error(`${prefix}${detail}，可在任务中心查看`)
				}
			} else if (finalError) {
				toast.error(
					`打包失败：${getMediaTaskError({ ...task, items: finalItems, error: taskError })}`,
				)
			} else {
				toast.success(`已打包 ${succeeded} 个文件`)
			}
		},
		[patchItem, patchTask],
	)

	const launchTask = useCallback(
		(task: MediaTask, isRetry = false) => {
			const workItems =
				isRetry && task.kind === 'add'
					? task.items.filter((item) => item.status === 'error')
					: task.items
			if (workItems.length === 0) return false
			if (workItems.some((item) => activeItemsRef.current.has(item.id))) {
				toast.info('所选媒体已有任务正在进行', { id: 'media-task-duplicate' })
				return false
			}
			if (task.kind === 'zip' && zipRunningRef.current) {
				toast.info('已有打包任务正在进行', { id: 'media-task-duplicate' })
				return false
			}
			for (const item of workItems) activeItemsRef.current.add(item.id)
			if (task.kind === 'zip') zipRunningRef.current = true
			setTasks((current) =>
				isRetry
					? current.map((item) => (item.id === task.id ? { ...item, status: 'running' } : item))
					: [task, ...current],
			)
			void executeTask(task, isRetry)
			toast.info('已加入后台任务，可在右下角查看进度', {
				id: 'media-task-enqueued',
				duration: 1800,
			})
			return true
		},
		[executeTask],
	)

	const startDownload = useCallback(
		(item: Parameters<typeof createMediaTask>[1][number]) =>
			launchTask(createMediaTask('download', [item], { title: `下载 · ${item.label}` })),
		[launchTask],
	)
	const startAdd = useCallback(
		(items: Parameters<typeof createMediaTask>[1], folderId: string | null, folderName: string) =>
			launchTask(
				createMediaTask('add', items, {
					title: `添加到 · ${folderName}`,
					folderId,
					folderName,
				}),
			),
		[launchTask],
	)
	const startZip = useCallback(
		(items: Parameters<typeof createMediaTask>[1], archiveName: string) =>
			launchTask(
				createMediaTask('zip', items, {
					title: `打包下载 · ${items.length} 项`,
					archiveName,
				}),
			),
		[launchTask],
	)

	const retryTask = useCallback(
		(taskId: string) => {
			const task = tasksRef.current.find((item) => item.id === taskId)
			if (!task || task.status === 'running') return
			launchTask({ ...task, status: 'running', error: undefined }, true)
		},
		[launchTask],
	)
	const dismissTask = useCallback((taskId: string) => {
		setTasks((current) => current.filter((task) => task.id !== taskId || task.status === 'running'))
	}, [])

	const activeItemIds = useMemo(() => {
		const ids = new Set<string>()
		for (const task of tasks) {
			if (task.status === 'running') {
				for (const item of task.items) ids.add(item.id)
			}
		}
		return ids
	}, [tasks])
	const zipRunning = tasks.some((task) => task.kind === 'zip' && task.status === 'running')

	return (
		<MediaTaskContext.Provider
			value={{
				tasks,
				activeItemIds,
				zipRunning,
				startDownload,
				startAdd,
				startZip,
				retryTask,
				dismissTask,
			}}
		>
			{children}
			<MediaTaskCenter />
		</MediaTaskContext.Provider>
	)
}
