import { type SchedulerTriggerType, schedulerRunDal } from '../dal/schedulerRunDal'
import { RUN_HISTORY_RETENTION_DAYS } from '../lib/runHistory'

/** 任务函数的返回：字符串即摘要；对象可额外标记 skipped 与结构化明细 */
export type SchedulerRunResult =
	| string
	| undefined
	| {
			message?: string
			status?: 'success' | 'skipped'
			detail?: Record<string, unknown>
	  }

export const schedulerRunService = {
	/**
	 * 执行任务并记录运行结果（定时执行与手动触发共用，所有任务都经此落库 scheduler_runs）。
	 * fn 可返回 string 作为结果信息，或 { message, status, detail }；抛异常则记录 failed。
	 */
	async runWithLog(
		taskName: string,
		triggerType: SchedulerTriggerType,
		fn: () => Promise<SchedulerRunResult>,
	): Promise<void> {
		const runId = await schedulerRunDal.create(taskName, triggerType)
		const startedAt = Date.now()
		try {
			const result = await fn()
			const normalized =
				typeof result === 'object' && result !== null ? result : { message: result }
			await schedulerRunDal.finish(runId, normalized.status ?? 'success', normalized.message, {
				...normalized.detail,
				triggerType,
			})
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			try {
				await schedulerRunDal.finish(runId, 'failed', message, {
					triggerType,
					error: message,
					stack:
						error instanceof Error ? error.stack?.split('\n').slice(0, 8).join('\n') : undefined,
					elapsedMs: Date.now() - startedAt,
				})
			} catch {
				/* 记录失败不影响异常传播 */
			}
			throw error
		} finally {
			// 保留期清理（索引命中，成本低；失败不影响任务）
			void schedulerRunDal.prune(RUN_HISTORY_RETENTION_DAYS).catch(() => {})
		}
	},
}
