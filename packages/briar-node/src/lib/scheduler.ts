import Bree from "bree"
import later from "@breejs/later"
import type { WorkerOptions } from "node:worker_threads"
import path from "path"
import { fileURLToPath } from "url"

type WorkerOptionsWithType = WorkerOptions & {
  type?: "module" | "commonjs"
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
}

const resolveRuntimeExtension = () => {
  const filename = fileURLToPath(import.meta.url)
  return path.extname(filename)
}

const resolveJobsRoot = () => {
  const filename = fileURLToPath(import.meta.url)
  const dirname = path.dirname(filename)
  return path.resolve(dirname, "../jobs")
}

export const startScheduler = (tasks: SchedulerTask[]) => {
  const runtimeExt = resolveRuntimeExtension()
  const jobExt = runtimeExt === ".ts" ? ".ts" : ".js"
  const jobsRoot = resolveJobsRoot()
  const worker =
    runtimeExt === ".ts"
      ? { execArgv: ["--import", "tsx/esm"], type: "module" }
      : undefined

  const jobs = tasks
    .filter((task) => task.enabled !== false)
    .map((task) => {
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
    defaultExtension: runtimeExt === ".ts" ? "ts" : "js",
    acceptedExtensions:
      runtimeExt === ".ts" ? [".ts", ".js", ".mjs"] : [".js", ".mjs"],
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
