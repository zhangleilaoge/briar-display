import type { Csi300EtfScaleResponse } from '@briar/shared'
import { csi300EtfScaleDal } from '../../dal/csi300EtfScaleDal'
import type { SchedulerRunResult } from '../schedulerRunService'
import { cachedLoad } from './cache'
import {
	CSI300_HISTORY_START,
	type Csi300EtfScaleSeed,
	buildScaleData,
	latestCompletedMonth,
	mergeSnapshots,
	monthBounds,
} from './csi300EtfScale'
import seedJson from './csi300EtfScale.seed.json'
import { fetchCompletedMonthSnapshots, fetchSseIndexMonth } from './csi300EtfSources'

const seed = seedJson as Csi300EtfScaleSeed
const CACHE_KEY = 'csi300:etf-scale'
const CACHE_TTL_MS = 5 * 60_000
const FALLBACK_MESSAGE = '增量快照暂不可用，展示内置历史数据'

async function loadScaleData() {
	let warning: string | undefined
	let stored: Awaited<ReturnType<typeof csi300EtfScaleDal.list>> = []
	try {
		stored = await csi300EtfScaleDal.list(CSI300_HISTORY_START)
	} catch (error) {
		warning = FALLBACK_MESSAGE
		console.warn(`[markets] ${CACHE_KEY} 增量快照读取失败，使用内置种子:`, error)
	}
	return {
		data: buildScaleData(mergeSnapshots(seed.snapshots, stored)),
		warning,
	}
}

export async function getCsi300EtfScale(): Promise<Csi300EtfScaleResponse> {
	const result = await cachedLoad(CACHE_KEY, CACHE_TTL_MS, loadScaleData)
	return {
		...result.value.data,
		fetchedAt: result.fetchedAt,
		stale: result.stale || Boolean(result.value.warning),
		error: result.error ?? result.value.warning,
	}
}

export interface Csi300EtfSyncDependencies {
	now: () => number
	fetchIndexMonth: typeof fetchSseIndexMonth
	fetchMonth: typeof fetchCompletedMonthSnapshots
	list: typeof csi300EtfScaleDal.list
	upsert: typeof csi300EtfScaleDal.upsertMany
}

const syncDependencies: Csi300EtfSyncDependencies = {
	now: Date.now,
	fetchIndexMonth: fetchSseIndexMonth,
	fetchMonth: fetchCompletedMonthSnapshots,
	list: csi300EtfScaleDal.list,
	upsert: csi300EtfScaleDal.upsertMany,
}

export async function syncCsi300EtfScale(
	deps: Csi300EtfSyncDependencies = syncDependencies,
): Promise<SchedulerRunResult> {
	const month = latestCompletedMonth(deps.now())
	const indices = await deps.fetchIndexMonth(month)
	if (indices.length === 0) {
		return {
			status: 'skipped',
			message: `${month} 沪深300官方月报尚未发布，保留已有快照`,
			detail: { month, snapshots: 0 },
		}
	}
	const stored = await deps.list(monthBounds(month).start)
	const existingDates = new Set([...seed.snapshots, ...stored].map((snapshot) => snapshot.date))
	const missing = indices.filter((index) => !existingDates.has(index.date))
	if (missing.length === 0) {
		return {
			status: 'skipped',
			message: `${month} 快照已完整，无需同步`,
			detail: { month, snapshots: 0, asOf: indices.at(-1)?.date },
		}
	}
	const snapshots = await deps.fetchMonth(month)
	if (
		snapshots.length !== indices.length ||
		snapshots.some((snapshot, index) => snapshot.date !== indices[index].date)
	) {
		throw new Error(`${month} ETF快照与官方交易日不完整，未写入数据库`)
	}
	await deps.upsert(snapshots)
	return {
		message: `${month} 头部沪深300ETF规模快照已同步 ${snapshots.length} 个交易日`,
		detail: { month, snapshots: snapshots.length, asOf: snapshots.at(-1)?.date },
	}
}
