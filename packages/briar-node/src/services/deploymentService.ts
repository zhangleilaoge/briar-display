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

const githubHeaders = () => ({
	Authorization: `Bearer ${process.env.BRIAR_GITHUB_TOKEN}`,
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
	 * 拉取 GitHub Actions 某次运行的全部 job 日志（拼接为单文本）
	 * 需要环境变量 BRIAR_GITHUB_TOKEN（actions:read 权限）
	 */
	async getRunLogs(runId: string): Promise<DeployRunLogs> {
		if (!process.env.BRIAR_GITHUB_TOKEN) {
			throw new Error('未配置 BRIAR_GITHUB_TOKEN，无法拉取 GitHub CI 日志')
		}
		if (!/^\d+$/.test(runId)) {
			throw new Error(`非法的 runId: ${runId}`)
		}

		const repo = resolveGithubRepo()
		const headers = githubHeaders()

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

		const parts: string[] = []
		for (const job of jobs) {
			parts.push(`\n===== ${job.name} [${job.conclusion ?? job.status}] =====\n`)
			try {
				// 该接口返回 302 跳转到日志下载地址，fetch 自动跟随
				const logRes = await fetch(`${GITHUB_API}/repos/${repo}/actions/jobs/${job.id}/logs`, {
					headers,
				})
				if (logRes.ok) {
					parts.push(await logRes.text())
				} else {
					parts.push(`(日志暂不可用: HTTP ${logRes.status})`)
				}
			} catch (error) {
				parts.push(`(日志拉取失败: ${error instanceof Error ? error.message : String(error)})`)
			}
		}

		return {
			runId,
			runStatus: run.status,
			conclusion: run.conclusion,
			logs: parts.join('\n'),
		}
	},
}
