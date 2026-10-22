import type { RunRecord, RunRecordStatus, RunStats } from '@briar/shared'

/** 运行记录保留天数（定时任务 / 证书续期记录统一） */
export const RUN_HISTORY_RETENTION_DAYS = 180

/** 迷你成功率条的统计窗口 */
export const RUN_STATS_WINDOW = 30

export const RUN_STATUSES: RunRecordStatus[] = ['running', 'success', 'skipped', 'failed']

const toIso = (value: Date | string | null): string | null => {
	if (!value) return null
	return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

export const durationMs = (
	startedAt: Date | string | null,
	finishedAt: Date | string | null,
): number | null => {
	if (!startedAt || !finishedAt) return null
	const diff = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
	return Number.isFinite(diff) && diff >= 0 ? diff : null
}

export const parseDetail = (value: unknown): Record<string, unknown> | null => {
	if (value === null || value === undefined) return null
	if (typeof value === 'object') return value as Record<string, unknown>
	if (typeof value === 'string') {
		try {
			const parsed = JSON.parse(value)
			return parsed && typeof parsed === 'object' ? parsed : { value: parsed }
		} catch {
			return { raw: value }
		}
	}
	return { value }
}

export const toRunRecord = (input: {
	id: string
	trigger: string
	status: RunRecordStatus
	message: string | null
	startedAt: Date | string
	finishedAt: Date | string | null
	detail?: unknown
}): RunRecord => ({
	id: input.id,
	trigger: input.trigger,
	status: input.status,
	message: input.message,
	startedAt: toIso(input.startedAt) ?? new Date(0).toISOString(),
	finishedAt: toIso(input.finishedAt),
	durationMs: durationMs(input.startedAt, input.finishedAt),
	detail: parseDetail(input.detail),
})

export const buildStats = (recent: RunRecordStatus[]): RunStats => ({
	window: RUN_STATS_WINDOW,
	total: recent.length,
	success: recent.filter((s) => s === 'success').length,
	failed: recent.filter((s) => s === 'failed').length,
	skipped: recent.filter((s) => s === 'skipped').length,
	recent,
})

/** 解析分页 + 状态筛选 query（limit 1~100，默认 20） */
export const parseHistoryQuery = (q: (key: string) => string | undefined) => {
	const limit = Math.min(100, Math.max(1, Number.parseInt(q('limit') ?? '', 10) || 20))
	const offset = Math.max(0, Number.parseInt(q('offset') ?? '', 10) || 0)
	const rawStatus = q('status')
	const status = RUN_STATUSES.includes(rawStatus as RunRecordStatus)
		? (rawStatus as RunRecordStatus)
		: undefined
	return { limit, offset, status }
}
