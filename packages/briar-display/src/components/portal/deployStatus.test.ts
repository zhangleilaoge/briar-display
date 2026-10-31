import { describe, expect, test } from 'bun:test'
import type { DeployHistoryItem } from '@/api/deploy'
import type { SiteVersion } from '@/api/version'
import {
	buildDeployStatus,
	formatDeployAge,
	formatDeployDuration,
	isCdnDeploy,
} from './deployStatus'

const NOW = Date.parse('2026-10-30T12:00:00.000Z')
const CURRENT = '111111122222223333333444444455555556666666'
const NEXT = 'abcdef0123456789abcdef0123456789abcdef01'

const version = (commit = CURRENT): SiteVersion => ({
	frontend: { commit, branch: 'master', dirty: false, builtAt: '', builder: 'ci' },
	backend: { commit, branch: 'master', dirty: false, builtAt: '', builder: 'ci' },
	startedAt: '',
})

const run = (status: string, commit = CURRENT): DeployHistoryItem => ({
	commit,
	ref: 'master',
	actor: 'ci',
	status,
	at: '2026-10-30T11:50:00.000Z',
	finishedAt: status === 'success' ? '2026-10-30T11:57:00.000Z' : undefined,
	run: '12345',
	workflowPath: '.github/workflows/deploy.yml',
})

describe('首页部署状态', () => {
	test('成功状态显示当前短 commit、上线时间和 Actions 链接', () => {
		expect(buildDeployStatus(version(), run('success'), NOW)).toEqual({
			commit: '1111111',
			fullCommit: CURRENT,
			light: '🟢',
			label: '3 分钟前上线',
			href: 'https://github.com/zhangleilaoge/briar-display/actions/runs/12345',
		})
	})

	test('发布中显示本次发布的 commit 和已用时间', () => {
		const status = buildDeployStatus(version(), run('in_progress', NEXT), NOW)
		expect(status).toMatchObject({
			commit: 'abcdef0',
			fullCommit: NEXT,
			light: '🟡',
			label: '发布中 · 10m 00s',
		})
		expect(formatDeployDuration('2026-10-30T11:58:35.000Z', NOW)).toBe('1m 25s')
		expect(formatDeployDuration('invalid', NOW)).toBe('')
	})

	test('失败与取消使用红灯，并显示对应 run 的 commit', () => {
		expect(buildDeployStatus(version(), run('failure', NEXT), NOW)).toMatchObject({
			commit: 'abcdef0',
			light: '🔴',
			label: '发布失败',
		})
		expect(buildDeployStatus(version(), run('cancelled', NEXT), NOW)?.label).toBe('发布已取消')
	})

	test('前后端版本不一致时提示同步中', () => {
		const value = version()
		value.backend = { ...value.backend!, commit: NEXT }
		expect(buildDeployStatus(value, run('success'), NOW)?.label).toBe('版本同步中')
	})

	test('仅构建提交不同但部署源码一致时，不显示同步中', () => {
		const value = version()
		value.frontend = { ...value.frontend!, sourceCommit: CURRENT }
		value.backend = { ...value.backend!, commit: NEXT, sourceCommit: CURRENT }
		expect(buildDeployStatus(value, run('success'), NOW)).toMatchObject({
			commit: CURRENT.slice(0, 7),
			light: '🟢',
			label: '3 分钟前上线',
		})
	})

	test('部署源码不同仍提示同步中，即使构建提交相同', () => {
		const value = version()
		value.frontend = { ...value.frontend!, sourceCommit: CURRENT }
		value.backend = { ...value.backend!, sourceCommit: NEXT }
		expect(buildDeployStatus(value, run('success'), NOW)?.label).toBe('版本同步中')
	})

	test('只采用主部署 workflow，并格式化相对时间', () => {
		expect(isCdnDeploy(run('success'))).toBe(true)
		expect(
			isCdnDeploy({ ...run('success'), workflowPath: '.github/workflows/deploy-nginx.yml' }),
		).toBe(false)
		expect(formatDeployAge('2026-10-30T10:00:00.000Z', NOW)).toBe('2 小时前')
		expect(formatDeployAge('invalid', NOW)).toBe('')
	})
})
