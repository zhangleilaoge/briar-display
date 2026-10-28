import * as fs from 'fs'
import * as path from 'path'
import { deployRunDal } from '../dal/deployRunDal'
import { type GithubJobLite, extractErrorExcerpt, pickFailedJobStep } from '../lib/deployFailure'
import { findRepoRoot } from './certificate/utils'

export interface DeployHistoryItem {
	commit: string
	ref: string
	actor: string
	status: string
	at: string
	run: string
	/** commit message（CI 追加 jsonl 时写入；GitHub API 源取 display_title；旧记录无此字段） */
	msg?: string
	/** 运行开始时间（GitHub run_started_at / CI 记录的 started_at；旧记录无） */
	startedAt?: string
	/** 运行结束时间（GitHub completed 时 updated_at / CI 记录的 at；运行中无） */
	finishedAt?: string
}

export interface DeployRunLogs {
	runId: string
	runStatus: string
	conclusion: string | null
	logs: string
}

export interface DeployStepInfo {
	name: string
	number: number
	status: string
	conclusion: string | null
	startedAt: string | null
	completedAt: string | null
}

export interface DeployJobProgress {
	name: string
	status: string
	conclusion: string | null
	steps: DeployStepInfo[]
}

export interface DeployRunProgress {
	runId: string
	runStatus: string
	conclusion: string | null
	jobs: DeployJobProgress[]
}

export interface DeployLiveProgress {
	available: boolean
	runId: string | null
	lines: string[]
}

const GITHUB_API = 'https://api.github.com'

const resolveGithubRepo = () => process.env.BRIAR_GITHUB_REPO || 'zhangleilaoge/briar-display'

interface GithubTokenCandidate {
	token: string
	source: string
}

/**
 * 从 .env 文件读取指定 key 的 token 值
 */
const readTokenFromEnvFile = (envPath: string, key: string): string | null => {
	try {
		const content = fs.readFileSync(envPath, 'utf-8')
		const regex = new RegExp(`^${key}=(.+)$`, 'm')
		const match = content.match(regex)
		// 值可能带引号（KEY="xxx"），需剥离，否则 Authorization 头非法导致 401
		const token = match?.[1].trim().replace(/^["']|["']$/g, '')
		return token || null
	} catch {
		return null
	}
}

/**
 * 收集所有可用的 GitHub token（按优先级）：
 * 1. BRIAR_GITHUB_TOKEN 环境变量
 * 2. briar-assets/briar/.env 里的 BRIAR_GITHUB_TOKEN（classic token，权限通常更全）
 * 3. briar-assets/github/.env 里的 FINED_GRAINED_GITHUB_TOKEN
 * 某个来源失效（如配置了错误值）时会自动尝试下一个
 */
const resolveGithubTokenCandidates = (): GithubTokenCandidate[] => {
	const candidates: GithubTokenCandidate[] = []
	const repoRoot = findRepoRoot(process.cwd())

	if (process.env.BRIAR_GITHUB_TOKEN) {
		candidates.push({ token: process.env.BRIAR_GITHUB_TOKEN, source: 'BRIAR_GITHUB_TOKEN (env)' })
	}

	const briarToken = readTokenFromEnvFile(
		path.join(repoRoot, 'briar-assets/briar/.env'),
		'BRIAR_GITHUB_TOKEN',
	)
	if (briarToken) {
		candidates.push({ token: briarToken, source: 'briar-assets/briar/.env' })
	}

	const fineGrainedToken = readTokenFromEnvFile(
		path.join(repoRoot, 'briar-assets/github/.env'),
		'FINED_GRAINED_GITHUB_TOKEN',
	)
	if (fineGrainedToken) {
		candidates.push({ token: fineGrainedToken, source: 'briar-assets/github/.env' })
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
 * 触发 GitHub Actions 的 nginx 配置部署 workflow
 */
async function triggerWorkflowDispatch(
	workflowId: string,
): Promise<{ runId: number; url: string }> {
	const candidates = resolveGithubTokenCandidates()
	if (candidates.length === 0) {
		throw new Error(
			'未找到 GitHub token（BRIAR_GITHUB_TOKEN 或 briar-assets/github/.env），无法触发 CI',
		)
	}

	const repo = resolveGithubRepo()
	let lastError: Error | null = null

	for (const { token, source } of candidates) {
		const tokenPrefix = token.slice(0, 12)
		try {
			const dispatchRes = await fetch(
				`${GITHUB_API}/repos/${repo}/actions/workflows/${workflowId}/dispatches`,
				{
					method: 'POST',
					headers: {
						...githubHeaders(token),
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ ref: 'master' }),
				},
			)
			if (!dispatchRes.ok) {
				throw new Error(
					`来源 ${source} (token ${tokenPrefix}...) 触发 workflow 失败: HTTP ${dispatchRes.status}`,
				)
			}

			// GitHub 创建 run 有短暂延迟，稍等再查
			await new Promise((resolve) => setTimeout(resolve, 1500))

			const runsRes = await fetch(
				`${GITHUB_API}/repos/${repo}/actions/workflows/${workflowId}/runs?per_page=1`,
				{ headers: githubHeaders(token) },
			)
			if (!runsRes.ok) {
				return {
					runId: 0,
					url: `https://github.com/${repo}/actions/workflows/${workflowId}`,
				}
			}
			const { workflow_runs } = (await runsRes.json()) as {
				workflow_runs: Array<{ id: number }>
			}
			const runId = workflow_runs[0]?.id ?? 0
			return {
				runId,
				url: runId
					? `https://github.com/${repo}/actions/runs/${runId}`
					: `https://github.com/${repo}/actions/workflows/${workflowId}`,
			}
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error))
			console.warn(
				`⚠️ token 来源 ${source} (${tokenPrefix}...) 触发 nginx 部署失败: ${lastError.message}`,
			)
		}
	}

	throw new Error(
		`${lastError?.message ?? '未知错误'}（已尝试 ${candidates.length} 个 token 来源均失败；请检查 token 是否有 Actions:write 权限）`,
	)
}

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
		let workingToken: string | null = null
		for (const { token, source } of resolveGithubTokenCandidates()) {
			try {
				apiRuns = await fetchRecentRuns(token, limit)
				workingToken = token
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
			const prev = byRun.get(item.run)
			// API 优先；API 缺结束时间（运行中）时不覆盖 jsonl 已有的起止
			byRun.set(item.run, {
				...item,
				startedAt: item.startedAt ?? prev?.startedAt,
				finishedAt: item.finishedAt ?? prev?.finishedAt,
			})
		}

		const merged = [...byRun.values()].sort((a, b) => b.at.localeCompare(a.at))
		// 落库：部署记录持久化到 deploy_runs（写库失败不影响列表返回）
		await deployRunDal.upsertMany(merged).catch((e) => console.error('部署记录落库失败:', e))
		// 回填：库中缺起止时间的旧记录，按 run_id 逐个查 GitHub（每次同步最多 BACKFILL_BATCH 条）
		if (workingToken) {
			await backfillDeployDurations(workingToken).catch((e) =>
				console.error('部署耗时回填失败:', e),
			)
			// 失败原因（job/step + 日志尾部片段）后台回填，不阻塞列表返回
			void backfillDeployFailures(workingToken)
		}
		return merged.slice(0, limit)
	},

	/**
	 * 触发远程 Nginx 配置部署（调用 GitHub Actions workflow_dispatch）
	 */
	async triggerNginxDeploy(): Promise<{ runId: number; url: string }> {
		return triggerWorkflowDispatch('deploy-nginx.yml')
	},

	/**
	 * 重试某次 GitHub Actions run：
	 * - 进行中/排队：先 cancel，再 rerun（卡住的 job 常用）
	 * - 已结束：直接 rerun（失败/取消也会整次重跑）
	 */
	async rerunDeployRun(runId: string): Promise<{ runId: string; url: string; cancelled: boolean }> {
		if (!/^\d+$/.test(runId)) {
			throw new Error(`非法的 runId: ${runId}`)
		}
		const candidates = resolveGithubTokenCandidates()
		if (candidates.length === 0) {
			throw new Error(
				'未找到 GitHub token（BRIAR_GITHUB_TOKEN 或 briar-assets/github/.env），无法重试 CI',
			)
		}
		const repo = resolveGithubRepo()
		let lastError: Error | null = null
		for (const { token, source } of candidates) {
			try {
				const headers = githubHeaders(token)
				const runRes = await fetch(`${GITHUB_API}/repos/${repo}/actions/runs/${runId}`, {
					headers,
				})
				if (!runRes.ok) {
					throw new Error(`查询 run 失败: HTTP ${runRes.status}`)
				}
				const run = (await runRes.json()) as { status: string; conclusion: string | null }
				let cancelled = false
				if (run.status !== 'completed') {
					const cancelRes = await fetch(
						`${GITHUB_API}/repos/${repo}/actions/runs/${runId}/cancel`,
						{ method: 'POST', headers },
					)
					// 202 = 已受理；409 = 已不可取消；都继续尝试 rerun
					if (!cancelRes.ok && cancelRes.status !== 409) {
						throw new Error(`取消 run 失败: HTTP ${cancelRes.status}`)
					}
					cancelled = cancelRes.ok
					// 等 cancel 落定，否则 rerun 会 403
					for (let i = 0; i < 8; i++) {
						await new Promise((r) => setTimeout(r, 750))
						const check = await fetch(`${GITHUB_API}/repos/${repo}/actions/runs/${runId}`, {
							headers,
						})
						if (!check.ok) break
						const cur = (await check.json()) as { status: string }
						if (cur.status === 'completed') break
					}
				}
				const rerunRes = await fetch(`${GITHUB_API}/repos/${repo}/actions/runs/${runId}/rerun`, {
					method: 'POST',
					headers,
				})
				if (!rerunRes.ok) {
					const body = await rerunRes.text().catch(() => '')
					throw new Error(
						`重试 run 失败: HTTP ${rerunRes.status}${body ? ` ${body.slice(0, 160)}` : ''}`,
					)
				}
				return {
					runId,
					url: `https://github.com/${repo}/actions/runs/${runId}`,
					cancelled,
				}
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error))
				console.warn(`⚠️  token 来源 ${source} 重试失败: ${lastError.message}`)
			}
		}
		throw new Error(
			`${lastError?.message ?? '未知错误'}（已尝试 ${candidates.length} 个 token 来源均失败）`,
		)
	},


	/**
	 * 某次运行的步骤级实时进度（jobs API 在运行中即可用，日志接口只能完成后拉取）
	 */
	async getRunProgress(runId: string): Promise<DeployRunProgress> {
		if (!/^\d+$/.test(runId)) {
			throw new Error(`非法的 runId: ${runId}`)
		}

		const candidates = resolveGithubTokenCandidates()
		if (candidates.length === 0) {
			throw new Error(
				'未找到 GitHub token（BRIAR_GITHUB_TOKEN 或 briar-assets/github/.env），无法拉取 CI 进度',
			)
		}

		let lastError: Error | null = null
		for (const { token, source } of candidates) {
			try {
				return await fetchRunProgressWithToken(runId, token)
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error))
				console.warn(`⚠️  token 来源 ${source} 拉取进度失败: ${lastError.message}`)
			}
		}
		throw new Error(
			`${lastError?.message ?? '未知错误'}（已尝试 ${candidates.length} 个 token 来源均失败）`,
		)
	},

	/**
	 * 服务器端 deploy.sh 的行级实时进度（CI 与后端同机，进度文件写在服务器本地）
	 * 进度文件格式：首行 `RUN <runId>`，之后每行 `HH:MM:SS 消息`
	 */
	getLiveProgress(): DeployLiveProgress {
		const file = process.env.DEPLOY_PROGRESS_FILE || '/tmp/briar-deploy-progress.log'
		try {
			const content = fs.readFileSync(file, 'utf-8')
			const lines = content.split('\n').filter((l) => l.length > 0)
			const runMatch = lines[0]?.match(/^RUN (\d+)/)
			return {
				available: true,
				runId: runMatch?.[1] ?? null,
				lines: lines.slice(-200),
			}
		} catch {
			return { available: false, runId: null, lines: [] }
		}
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
			updated_at?: string
			run_started_at?: string
			display_title?: string
			actor: { login: string } | null
		}>
	}

	return workflow_runs.map(githubRunToItem)
}

type GithubRun = {
	id: number
	head_sha: string
	head_branch: string
	status: string
	conclusion: string | null
	created_at: string
	updated_at?: string
	run_started_at?: string
	display_title?: string
	actor: { login: string } | null
}

/** GitHub run → 部署记录（耗时 = run_started_at → completed 时的 updated_at） */
const githubRunToItem = (run: GithubRun): DeployHistoryItem => ({
	commit: run.head_sha,
	ref: run.head_branch,
	actor: run.actor?.login ?? '',
	status: run.status === 'completed' ? (run.conclusion ?? 'completed') : run.status,
	at: run.created_at,
	run: String(run.id),
	msg: run.display_title,
	startedAt: run.run_started_at ?? run.created_at,
	finishedAt: run.status === 'completed' ? run.updated_at : undefined,
})

const BACKFILL_BATCH = 20

const backfillDeployDurations = async (token: string): Promise<void> => {
	const runIds = await deployRunDal.listMissingDuration(BACKFILL_BATCH)
	const items: DeployHistoryItem[] = []
	for (const runId of runIds) {
		if (!/^\d+$/.test(runId)) continue
		const item = await fetchRunById(token, runId).catch(() => null)
		if (item?.startedAt && item.finishedAt) items.push(item)
	}
	if (items.length > 0) await deployRunDal.upsertMany(items)
}

const FAILURE_BATCH = 3
let failureBackfillRunning = false

/** 失败 run：拉 jobs 定位失败 job/step，再拉该 job 日志截取报错片段，写回 deploy_runs */
const backfillDeployFailures = async (token: string): Promise<void> => {
	if (failureBackfillRunning) return
	failureBackfillRunning = true
	try {
		const repo = resolveGithubRepo()
		const headers = githubHeaders(token)
		const runIds = await deployRunDal.listMissingFailure(FAILURE_BATCH)
		for (const runId of runIds) {
			if (!/^\d+$/.test(runId)) continue
			try {
				const jobsRes = await fetch(
					`${GITHUB_API}/repos/${repo}/actions/runs/${runId}/jobs?per_page=100&filter=latest`,
					{ headers, signal: AbortSignal.timeout(15000) },
				)
				if (jobsRes.status === 404) {
					await deployRunDal.saveFailure(runId, { job: null, step: null, excerpt: null })
					continue
				}
				if (!jobsRes.ok) throw new Error(`HTTP ${jobsRes.status}`)
				const { jobs } = (await jobsRes.json()) as { jobs: GithubJobLite[] }
				const info = pickFailedJobStep(jobs ?? [])
				let excerpt: string | null = null
				if (info.jobId) {
					const logRes = await fetch(
						`${GITHUB_API}/repos/${repo}/actions/jobs/${info.jobId}/logs`,
						{
							headers,
							signal: AbortSignal.timeout(20000),
						},
					).catch(() => null)
					if (logRes?.ok) excerpt = extractErrorExcerpt(await logRes.text())
					else if (logRes && logRes.status !== 404 && logRes.status !== 410) continue // 暂不可用，下次再试
				}
				await deployRunDal.saveFailure(runId, { job: info.job, step: info.step, excerpt })
			} catch (e) {
				console.warn(`⚠️  部署失败原因回填 run ${runId} 失败:`, e instanceof Error ? e.message : e)
			}
		}
	} catch (e) {
		console.error('部署失败原因回填失败:', e)
	} finally {
		failureBackfillRunning = false
	}
}

/** 单个 run 详情（用于回填旧记录的开始/结束时间） */
const fetchRunById = async (token: string, runId: string): Promise<DeployHistoryItem | null> => {
	const repo = resolveGithubRepo()
	const res = await fetch(`${GITHUB_API}/repos/${repo}/actions/runs/${runId}`, {
		headers: githubHeaders(token),
	})
	if (res.status === 404) return null
	if (!res.ok) throw new Error(`查询 run ${runId} 失败: HTTP ${res.status}`)
	return githubRunToItem((await res.json()) as GithubRun)
}

/** 用指定 token 拉取 run 状态 + job 步骤进度（steps 在运行中即可用） */
const fetchRunProgressWithToken = async (
	runId: string,
	token: string,
): Promise<DeployRunProgress> => {
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
		jobs: Array<{
			name: string
			status: string
			conclusion: string | null
			steps: Array<{
				name: string
				number: number
				status: string
				conclusion: string | null
				started_at: string | null
				completed_at: string | null
			}>
		}>
	}

	return {
		runId,
		runStatus: run.status,
		conclusion: run.conclusion,
		jobs: jobs.map((job) => ({
			name: job.name,
			status: job.status,
			conclusion: job.conclusion,
			steps: (job.steps ?? []).map((s) => ({
				name: s.name,
				number: s.number,
				status: s.status,
				conclusion: s.conclusion,
				startedAt: s.started_at,
				completedAt: s.completed_at,
			})),
		})),
	}
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
