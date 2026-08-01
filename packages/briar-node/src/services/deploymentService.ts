import * as fs from 'fs'
import * as path from 'path'
import { findRepoRoot } from './certificate/utils'

export interface DeployHistoryItem {
	commit: string
	ref: string
	actor: string
	status: string
	at: string
	run: string
}

export interface DeployRunLogs {
	runId: string
	runStatus: string
	conclusion: string | null
	logs: string
}

const GITHUB_API = 'https://api.github.com'

const resolveGithubRepo = () => process.env.BRIAR_GITHUB_REPO || 'zhangleilaoge/briar-display'

interface GithubTokenCandidate {
	token: string
	source: string
}

/**
 * 收集所有可用的 GitHub token（按优先级）：
 * 1. BRIAR_GITHUB_TOKEN 环境变量
 * 2. briar-assets/github/.env 里的 FINED_GRAINED_GITHUB_TOKEN（服务器上会同步该文件）
 * 某个来源失效（如配置了错误值）时会自动尝试下一个
 */
const resolveGithubTokenCandidates = (): GithubTokenCandidate[] => {
	const candidates: GithubTokenCandidate[] = []
	if (process.env.BRIAR_GITHUB_TOKEN) {
		candidates.push({ token: process.env.BRIAR_GITHUB_TOKEN, source: 'BRIAR_GITHUB_TOKEN' })
	}
	try {
		const envPath = path.join(findRepoRoot(process.cwd()), 'briar-assets/github/.env')
		const content = fs.readFileSync(envPath, 'utf-8')
		const match = content.match(/^FINED_GRAINED_GITHUB_TOKEN=(.+)$/m)
		// 值可能带引号（KEY="xxx"），需剥离，否则 Authorization 头非法导致 401
		const token = match?.[1].trim().replace(/^["']|["']$/g, '')
		if (token) {
			candidates.push({ token, source: 'briar-assets/github/.env' })
		}
	} catch {
		// 文件不存在等情况，忽略
	}
	return candidates
}

const githubHeaders = (token: string) => ({
	Authorization: `Bearer ${token}`,
	Accept: 'application/vnd.github+json',
	'User-Agent': 'briar-node',
	'X-GitHub-Api-Version': '2022-11-28',
})

/**
 * 部署记录服务
 * 读取服务器上由 CI 追加的 briar-assets/deploy-history.jsonl（不在 git 中，仅服务器存在）
 */
export const deploymentService = {
	async listDeployHistory(limit = 50): Promise<DeployHistoryItem[]> {
		const repoRoot = findRepoRoot(process.cwd())
		const historyPath = path.join(repoRoot, 'briar-assets/deploy-history.jsonl')

		if (!fs.existsSync(historyPath)) {
			return []
		}

		try {
			const content = fs.readFileSync(historyPath, 'utf-8')
			const items = content
				.split('\n')
				.map((line) => line.trim())
				.filter(Boolean)
				.map((line) => {
					try {
						return JSON.parse(line) as DeployHistoryItem
					} catch {
						return null
					}
				})
				.filter((item): item is DeployHistoryItem => item !== null)

			return items.reverse().slice(0, limit)
		} catch (error) {
			console.error('读取部署记录失败:', error)
			return []
		}
	},

	/**
	 * 部署记录：jsonl 历史 + GitHub 实时 runs 合并
	 * API 数据更新（状态实时），同一 run 以 API 为准；token 全失效时退回纯 jsonl
	 */
	async listDeployRuns(limit = 20): Promise<DeployHistoryItem[]> {
		const history = await this.listDeployHistory(50)

		let apiRuns: DeployHistoryItem[] = []
		for (const { token, source } of resolveGithubTokenCandidates()) {
			try {
				apiRuns = await fetchRecentRuns(token, limit)
				break
			} catch (error) {
				console.warn(
					`⚠️  token 来源 ${source} 查询 runs 失败:`,
					error instanceof Error ? error.message : error,
				)
			}
		}

		const byRun = new Map<string, DeployHistoryItem>()
		for (const item of history) {
			if (item.run) byRun.set(item.run, item)
		}
		for (const item of apiRuns) {
			byRun.set(item.run, item)
		}

		return [...byRun.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit)
	},

	/**
	 * 拉取 GitHub Actions 某次运行的全部 job 日志（拼接为单文本）
	 * 依次尝试所有可用的 token 来源，全部失败才报错
	 */
	async getRunLogs(runId: string): Promise<DeployRunLogs> {
		if (!/^\d+$/.test(runId)) {
			throw new Error(`非法的 runId: ${runId}`)
		}

		// 已完成 run 的日志不可变，走内存缓存避免重复跨境拉取
		const cached = runLogsCache.get(runId)
		if (cached) {
			return cached
		}

		const candidates = resolveGithubTokenCandidates()
		if (candidates.length === 0) {
			throw new Error(
				'未找到 GitHub token（BRIAR_GITHUB_TOKEN 或 briar-assets/github/.env），无法拉取 CI 日志',
			)
		}

		let lastError: Error | null = null
		for (const { token, source } of candidates) {
			try {
				const result = await fetchRunLogsWithToken(runId, token)
				if (result.runStatus === 'completed') {
					if (runLogsCache.size >= 50) {
						runLogsCache.delete(runLogsCache.keys().next().value as string)
					}
					runLogsCache.set(runId, result)
				}
				return result
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error))
				console.warn(`⚠️  token 来源 ${source} 拉取日志失败: ${lastError.message}`)
			}
		}
		throw new Error(
			`${lastError?.message ?? '未知错误'}（已尝试 ${candidates.length} 个 token 来源均失败）`,
		)
	},
}

/** 已完成 run 的日志缓存（不可变数据，无需过期） */
const runLogsCache = new Map<string, DeployRunLogs>()

/** 从 GitHub API 查询最近的 workflow runs（含进行中的） */
const fetchRecentRuns = async (token: string, limit: number): Promise<DeployHistoryItem[]> => {
	const repo = resolveGithubRepo()
	const res = await fetch(`${GITHUB_API}/repos/${repo}/actions/runs?per_page=${limit}`, {
		headers: githubHeaders(token),
	})
	if (!res.ok) {
		throw new Error(`查询 workflow runs 失败: HTTP ${res.status}`)
	}
	const { workflow_runs } = (await res.json()) as {
		workflow_runs: Array<{
			id: number
			head_sha: string
			head_branch: string
			status: string
			conclusion: string | null
			created_at: string
			actor: { login: string } | null
		}>
	}

	return workflow_runs.map((run) => ({
		commit: run.head_sha,
		ref: run.head_branch,
		actor: run.actor?.login ?? '',
		status: run.status === 'completed' ? (run.conclusion ?? 'completed') : run.status,
		at: run.created_at,
		run: String(run.id),
	}))
}

/** 用指定 token 拉取 run 状态 + 全部 job 日志 */
const fetchRunLogsWithToken = async (runId: string, token: string): Promise<DeployRunLogs> => {
	const repo = resolveGithubRepo()
	const headers = githubHeaders(token)

	const runRes = await fetch(`${GITHUB_API}/repos/${repo}/actions/runs/${runId}`, { headers })
	if (!runRes.ok) {
		throw new Error(`查询 workflow run 失败: HTTP ${runRes.status}`)
	}
	const run = (await runRes.json()) as { status: string; conclusion: string | null }

	const jobsRes = await fetch(
		`${GITHUB_API}/repos/${repo}/actions/runs/${runId}/jobs?per_page=100`,
		{ headers },
	)
	if (!jobsRes.ok) {
		throw new Error(`查询 jobs 失败: HTTP ${jobsRes.status}`)
	}
	const { jobs } = (await jobsRes.json()) as {
		jobs: Array<{ id: number; name: string; status: string; conclusion: string | null }>
	}

	// 多 job 并行拉取日志（每个请求都要 302 跳转下载，串行会叠加跨境延迟）
	const parts = await Promise.all(
		jobs.map(async (job) => {
			const header = `\n===== ${job.name} [${job.conclusion ?? job.status}] =====\n`
			try {
				// 该接口返回 302 跳转到日志下载地址，fetch 自动跟随
				const logRes = await fetch(`${GITHUB_API}/repos/${repo}/actions/jobs/${job.id}/logs`, {
					headers,
				})
				if (logRes.ok) {
					return header + (await logRes.text())
				}
				return `${header}(日志暂不可用: HTTP ${logRes.status})`
			} catch (error) {
				return `${header}(日志拉取失败: ${error instanceof Error ? error.message : String(error)})`
			}
		}),
	)

	return {
		runId,
		runStatus: run.status,
		conclusion: run.conclusion,
		logs: parts.join('\n'),
	}
}
