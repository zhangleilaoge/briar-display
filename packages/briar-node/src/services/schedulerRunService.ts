import { type SchedulerTriggerType, schedulerRunDal } from '../dal/schedulerRunDal'

export const schedulerRunService = {
	/**
	 * 执行任务并记录运行结果（定时执行与手动触发共用）。
	 * fn 可返回 string 作为结果信息；抛异常则记录 failed。
	 */
	async runWithLog(
		taskName: string,
		triggerType: SchedulerTriggerType,
		fn: () => Promise<string | undefined>,
	): Promise<void> {
		const runId = await schedulerRunDal.create(taskName, triggerType)
		try {
			const result = await fn()
			await schedulerRunDal.finish(
				runId,
				'success',
				typeof result === 'string' ? result : undefined,
			)
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			try {
				await schedulerRunDal.finish(runId, 'failed', message)
			} catch {
				/* 记录失败不影响异常传播 */
			}
			throw error
		}
	},
}
