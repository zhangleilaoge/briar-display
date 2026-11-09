import { describe, expect, it } from 'bun:test'
import { createMediaTask, getMediaTaskError, getMediaTaskPercent } from './mediaTaskUtils'
import type { MediaItem } from './toolMediaUtils'

const media = (id: string): MediaItem => ({
	id,
	kind: 'video',
	url: `https://example.com/${id}.mp4`,
	sourceUrl: 'https://example.com/post',
	label: id,
	filename: `${id}.mp4`,
})

describe('media task progress', () => {
	it('uses the item percent for downloads', () => {
		const task = createMediaTask('download', [media('video')], { title: '下载' })
		task.items[0] = { ...task.items[0], status: 'running', progress: { percent: 42 } }
		expect(getMediaTaskPercent(task)).toBe(42)
	})

	it('weights download and upload equally for each added item', () => {
		const task = createMediaTask('add', [media('one'), media('two')], {
			title: '添加',
			folderName: '根目录',
		})
		task.items[0] = {
			...task.items[0],
			status: 'running',
			phase: 'download',
			progress: { percent: 80 },
		}
		task.items[1] = {
			...task.items[1],
			status: 'running',
			phase: 'upload',
			progress: { percent: 40 },
		}
		expect(getMediaTaskPercent(task)).toBe(55)
	})

	it('counts finished and failed items as processed in batch tasks', () => {
		const task = createMediaTask('add', [media('one'), media('two'), media('three')], {
			title: '添加',
		})
		task.items[0] = { ...task.items[0], status: 'success', progress: { percent: 100 } }
		task.items[1] = { ...task.items[1], status: 'error', error: '相同文件已存在' }
		expect(getMediaTaskPercent(task)).toBe(67)
		expect(getMediaTaskError(task)).toBe('相同文件已存在')
	})

	it('distinguishes packing from a completed archive', () => {
		const task = createMediaTask('zip', [media('video')], { title: '打包' })
		task.packing = true
		expect(getMediaTaskPercent(task)).toBe(99)
		task.status = 'success'
		expect(getMediaTaskPercent(task)).toBe(100)
	})
})
