import { mkdirSync } from 'fs'
import type { WorkerOptions } from 'node:worker_threads'
import path from 'path'
import { fileURLToPath } from 'url'
import later from '@breejs/later'
import Bree from 'bree'

type WorkerOptionsWithType = WorkerOptions & {
	type?: 'module' | 'commonjs'
}

export type SchedulerTask = {
	name: string
	interval?: string
	cron?: string
	timeout?: string
	path?: string | (() => void | Promise<void>)
	worker?: WorkerOptionsWithType
	enabled?: boolean
	runOnStart?: boolean
	/** 卡片显示名（管理后台「定时任务」卡片） */
	label?: string
	/** 任务描述（卡片副文案） */
	description?: string
	/** 人类可读的调度说明（如「每日 04:43」），避免前端解析 cron */
	scheduleText?: string
	/** 手动触发（主进程内执行，可返回结果信息）；缺省则不支持手动触发 */
	run?: () => Promise<string | undefined>
}

const resolveRuntimeExtension = () => {
	const filename = fileURLToPath(import.meta.url)
	return path.extname(filename)
}

const resolveJobsRoot = () => {
	const filename = fileURLToPath(import.meta.url)
	const dirname = path.dirname(filename)
	// Jobs directory is at package root (sibling to dist/), not inside dist/
	// This works because tsup onSuccess copies jobs to both locations
	return path.resolve(dirname, '../jobs')
}

export const startScheduler = (tasks: SchedulerTask[]) => {
	const runtimeExt = resolveRuntimeExtension()
	const isDev = runtimeExt === '.ts'
	const jobsRoot = resolveJobsRoot()

	// Ensure jobs directory exists (Bree requires root directory to exist)
	try {
		mkdirSync(jobsRoot, { recursive: true })
	} catch {
		// Directory might already exist, ignore error
	}

	const worker = isDev ? { execArgv: ['--import', 'tsx/esm'], type: 'module' } : undefined

	const jobs = tasks
		.filter((task) => task.enabled !== false)
		.map((task) => {
			const jobExt = '.mjs'
			const jobPath = task.path ?? path.join(jobsRoot, `${task.name}${jobExt}`)

			const job: {
				name: string
				interval?: string | { schedules: unknown[] }
				timeout?: string
				path: string | (() => void | Promise<void>)
				worker?: WorkerOptionsWithType
			} = {
				name: task.name,
				path: jobPath,
				worker: task.worker,
			}

			if (task.cron !== undefined) {
				job.interval = later.parse.cron(task.cron, false)
			} else if (task.interval !== undefined) {
				job.interval = task.interval
			}

			if (task.timeout !== undefined) {
				job.timeout = task.timeout
			}

			return job
		})

	const bree = new Bree({
		root: jobsRoot,
		jobs,
		worker,
		defaultExtension: 'mjs',
		acceptedExtensions: ['.mjs', '.js', '.ts'],
		logger: {
			info() {},
			warn() {},
			error: console.error,
		},
		outputWorkerMetadata: false,
	})
	bree.start()

	for (const task of tasks) {
		if (task.enabled === false) {
			continue
		}
		if (task.runOnStart) {
			void bree.run(task.name)
		}
	}

	return bree
}
