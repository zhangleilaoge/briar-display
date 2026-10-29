/**
 * 发布站内信：文案与判定（纯函数，便于单测）
 * 仅 CDN 主流程 deploy.yml；开始/失败通知管理员，成功不发。
 */

import { githubRunUrl } from './deployFailure'

export const CDN_DEPLOY_WORKFLOW = '.github/workflows/deploy.yml'

const FAILED = new Set([
	'failure',
	'failed',
	'cancelled',
	'timed_out',
	'startup_failure',
	'action_required',
])

/** jsonl 无 path 时视为 CDN；API 带来的其它 workflow（nginx / jwks）跳过 */
export const isCdnDeployWorkflow = (workflowPath?: string | null): boolean => {
	if (!workflowPath) return true
	return /(^|\/)deploy\.yml$/.test(workflowPath)
}

export const isDeployRunningStatus = (status: string): boolean => {
	const s = status.toLowerCase()
	if (s === 'success' || FAILED.has(s) || s === 'skipped' || s === 'neutral') return false
	return true
}

export const isDeployFailedStatus = (status: string): boolean => FAILED.has(status.toLowerCase())

const shortSha = (sha: string) => (sha.length > 7 ? sha.slice(0, 7) : sha)

const truncate = (text: string, max: number) =>
	text.length <= max ? text : `${text.slice(0, max - 1)}…`

export interface DeployNotifyStartInput {
	runId: string
	commit: string
	ref: string
	actor: string
	msg?: string | null
	repo?: string
}

export interface DeployNotifyFailInput extends DeployNotifyStartInput {
	status: string
	failedJob?: string | null
	failedStep?: string | null
	errorExcerpt?: string | null
}

export const buildDeployStartMessage = (
	input: DeployNotifyStartInput,
): { type: string; title: string; content: string } => {
	const repo = input.repo || 'zhangleilaoge/briar-display'
	const lines = [
		'CDN 部署已开始。',
		`触发：${input.actor || '未知'}`,
		`分支：${input.ref || '未知'}`,
		`提交：${shortSha(input.commit || '')}`,
	]
	if (input.msg?.trim()) lines.push(`说明：${truncate(input.msg.trim().split('\n')[0], 120)}`)
	if (/^\d+$/.test(input.runId)) lines.push(`Actions：${githubRunUrl(repo, input.runId)}`)
	return {
		type: 'deploy_start',
		title: '发布开始',
		content: lines.join('\n'),
	}
}

export const buildDeployFailMessage = (
	input: DeployNotifyFailInput,
): { type: string; title: string; content: string } => {
	const repo = input.repo || 'zhangleilaoge/briar-display'
	const lines = [
		'CDN 部署失败。',
		`状态：${input.status || 'failure'}`,
		`触发：${input.actor || '未知'}`,
		`分支：${input.ref || '未知'}`,
		`提交：${shortSha(input.commit || '')}`,
	]
	if (input.msg?.trim()) lines.push(`说明：${truncate(input.msg.trim().split('\n')[0], 120)}`)
	if (input.failedJob) {
		lines.push(
			input.failedStep
				? `失败步骤：${input.failedJob} / ${input.failedStep}`
				: `失败 Job：${input.failedJob}`,
		)
	}
	if (/^\d+$/.test(input.runId)) lines.push(`Actions：${githubRunUrl(repo, input.runId)}`)
	if (input.errorExcerpt?.trim()) {
		lines.push('', '报错摘录：', truncate(input.errorExcerpt.trim(), 800))
	}
	return {
		type: 'deploy_fail',
		title: '发布失败',
		content: lines.join('\n'),
	}
}
