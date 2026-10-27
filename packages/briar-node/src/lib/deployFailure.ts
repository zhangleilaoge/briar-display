/**
 * 部署失败原因提取（纯函数，便于单测）：
 * 从 GitHub jobs 列表挑出失败的 job/step，从该 job 日志尾部截取报错片段
 */

export interface GithubJobLite {
	id: number
	name: string
	status: string
	conclusion: string | null
	steps?: Array<{ name: string; number: number; conclusion: string | null }>
}

export interface DeployFailureInfo {
	jobId: number | null
	job: string | null
	step: string | null
}

const BAD = new Set(['failure', 'timed_out', 'cancelled', 'startup_failure', 'action_required'])

/** 优先 conclusion=failure 的 job/step，其次其它非成功结论 */
export const pickFailedJobStep = (jobs: GithubJobLite[]): DeployFailureInfo => {
	const job =
		jobs.find((j) => j.conclusion === 'failure') ??
		jobs.find((j) => j.conclusion !== null && BAD.has(j.conclusion)) ??
		null
	if (!job) return { jobId: null, job: null, step: null }
	const steps = job.steps ?? []
	const step =
		steps.find((s) => s.conclusion === 'failure') ??
		steps.find((s) => s.conclusion !== null && BAD.has(s.conclusion)) ??
		null
	return { jobId: job.id, job: job.name, step: step?.name ?? null }
}

const TS_PREFIX = /^\uFEFF?\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z ?/
const MAX_LINES_BEFORE = 30
const MAX_CHARS = 4000

/**
 * 日志 → 报错片段：以最后一个 ##[error] 行为锚点，取其前 30 行；无锚点则取末尾 30 行。
 * 去掉行首时间戳与 ##[group] 标记，截断到 4000 字符（保留尾部）
 */
export const extractErrorExcerpt = (log: string): string | null => {
	const lines = log
		.split(/\r?\n/)
		.map((l) => l.replace(TS_PREFIX, ''))
		.filter((l) => !/^##\[(?:end)?group\]\s*$/.test(l) && l !== '##[endgroup]')
	while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop()
	if (lines.length === 0) return null

	let anchor = -1
	for (let i = lines.length - 1; i >= 0; i--) {
		if (lines[i].includes('##[error]')) {
			anchor = i
			break
		}
	}
	const end = anchor >= 0 ? anchor + 1 : lines.length
	const start = Math.max(0, end - MAX_LINES_BEFORE)
	let excerpt = lines
		.slice(start, end)
		.map((l) => l.replace('##[error]', 'ERROR: ').replace(/^##\[group\]/, ''))
		.join('\n')
		.trim()
	if (excerpt.length > MAX_CHARS) excerpt = `…${excerpt.slice(-MAX_CHARS)}`
	return excerpt || null
}

export const githubRunUrl = (repo: string, runId: string) =>
	`https://github.com/${repo}/actions/runs/${runId}`
