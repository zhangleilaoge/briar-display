import type { DeployHistoryItem } from '@/api/deploy'
import type { SiteVersion } from '@/api/version'

const GITHUB_REPO = 'https://github.com/zhangleilaoge/briar-display'
const RUNNING_STATUSES = new Set(['in_progress', 'queued', 'waiting', 'requested', 'pending'])
const FAILED_STATUSES = new Set(['failure', 'failed', 'timed_out', 'startup_failure'])

export const isCdnDeploy = (item: DeployHistoryItem) =>
	!item.workflowPath || /(^|\/)deploy\.yml$/.test(item.workflowPath)

export const isDeployRunning = (status: string) => RUNNING_STATUSES.has(status.toLowerCase())

export function formatDeployAge(value: string, now: number): string {
	const timestamp = Date.parse(value)
	if (!Number.isFinite(timestamp)) return ''
	const minutes = Math.max(0, Math.floor((now - timestamp) / 60000))
	if (minutes < 1) return '刚刚'
	if (minutes < 60) return `${minutes} 分钟前`
	const hours = Math.floor(minutes / 60)
	if (hours < 24) return `${hours} 小时前`
	return `${Math.floor(hours / 24)} 天前`
}

export function formatDeployDuration(value: string, now: number): string {
	const timestamp = Date.parse(value)
	if (!Number.isFinite(timestamp)) return ''
	const seconds = Math.max(0, Math.floor((now - timestamp) / 1000))
	return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`
}

export interface DeployStatusModel {
	commit: string
	fullCommit: string
	light: '🟢' | '🟡' | '🔴'
	label: string
	href: string
}

export function buildDeployStatus(
	version: SiteVersion | null,
	latest: DeployHistoryItem | null,
	now: number,
): DeployStatusModel | null {
	const frontendCommit = version?.frontend?.commit ?? ''
	const backendCommit = version?.backend?.commit ?? ''
	const frontendSource = version?.frontend?.sourceCommit || frontendCommit
	const backendSource = version?.backend?.sourceCommit || backendCommit
	const currentCommit = frontendCommit || backendCommit
	const fullCommit =
		latest && isDeployRunning(latest.status) ? latest.commit : currentCommit || latest?.commit || ''
	if (!fullCommit) return null

	const href = latest?.run
		? `${GITHUB_REPO}/actions/runs/${latest.run}`
		: `${GITHUB_REPO}/commit/${fullCommit}`
	const base = { commit: fullCommit.slice(0, 7), fullCommit, href }

	if (latest && isDeployRunning(latest.status)) {
		const elapsed = formatDeployDuration(latest.startedAt || latest.at, now)
		return { ...base, light: '🟡', label: elapsed ? `发布中 · ${elapsed}` : '发布中' }
	}
	if (frontendSource && backendSource && frontendSource !== backendSource) {
		return { ...base, light: '🟡', label: '版本同步中' }
	}
	if (latest && FAILED_STATUSES.has(latest.status.toLowerCase())) {
		return {
			...base,
			fullCommit: latest.commit,
			commit: latest.commit.slice(0, 7),
			light: '🔴',
			label: '发布失败',
		}
	}
	if (latest?.status.toLowerCase() === 'cancelled') {
		return {
			...base,
			fullCommit: latest.commit,
			commit: latest.commit.slice(0, 7),
			light: '🔴',
			label: '发布已取消',
		}
	}
	if (latest?.status === 'success') {
		if (currentCommit && latest.commit !== currentCommit) {
			return { ...base, light: '🟡', label: '版本待同步' }
		}
		const age = formatDeployAge(latest.finishedAt || latest.at, now)
		return { ...base, light: '🟢', label: age ? `${age}上线` : '已上线' }
	}
	if (currentCommit) return { ...base, light: '🟢', label: '当前版本' }
	return { ...base, light: '🟡', label: '状态未知' }
}
