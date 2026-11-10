import { describe, expect, test } from 'bun:test'
import {
	buildDeployFailMessage,
	buildDeploySuccessMessage,
	isCdnDeployWorkflow,
	isDeployFailedStatus,
	isDeploySuccessStatus,
} from './deployNotify'

describe('isCdnDeployWorkflow', () => {
	test('empty / null → true（jsonl）', () => {
		expect(isCdnDeployWorkflow(null)).toBe(true)
		expect(isCdnDeployWorkflow('')).toBe(true)
		expect(isCdnDeployWorkflow(undefined)).toBe(true)
	})
	test('deploy.yml only', () => {
		expect(isCdnDeployWorkflow('.github/workflows/deploy.yml')).toBe(true)
		expect(isCdnDeployWorkflow('deploy.yml')).toBe(true)
		expect(isCdnDeployWorkflow('.github/workflows/deploy-nginx.yml')).toBe(false)
		expect(isCdnDeployWorkflow('.github/workflows/google-jwks.yml')).toBe(false)
	})
})

describe('status helpers', () => {
	test('success', () => {
		expect(isDeploySuccessStatus('success')).toBe(true)
		expect(isDeploySuccessStatus('SUCCESS')).toBe(true)
		expect(isDeploySuccessStatus('in_progress')).toBe(false)
		expect(isDeploySuccessStatus('failure')).toBe(false)
	})
	test('failed-like', () => {
		expect(isDeployFailedStatus('failure')).toBe(true)
		expect(isDeployFailedStatus('cancelled')).toBe(true)
		expect(isDeployFailedStatus('success')).toBe(false)
		expect(isDeployFailedStatus('in_progress')).toBe(false)
	})
})

describe('message builders', () => {
	test('success message', () => {
		const msg = buildDeploySuccessMessage({
			runId: '123',
			commit: 'abcdef012345',
			ref: 'master',
			actor: 'zhangleilaoge',
			msg: 'fix: something',
		})
		expect(msg.type).toBe('deploy_success')
		expect(msg.title).toBe('发布成功')
		expect(msg.content).toContain('CDN 部署成功')
		expect(msg.content).toContain('abcdef0')
		expect(msg.content).toContain('fix: something')
		expect(msg.content).toContain('https://github.com/zhangleilaoge/briar-display/actions/runs/123')
	})
	test('fail message with excerpt', () => {
		const msg = buildDeployFailMessage({
			runId: '99',
			commit: 'deadbeef',
			ref: 'refs/heads/master',
			actor: 'ci',
			status: 'failure',
			failedJob: 'build-and-deploy',
			failedStep: 'Run backend tests',
			errorExcerpt: 'ERROR: Process completed with exit code 1.',
		})
		expect(msg.type).toBe('deploy_fail')
		expect(msg.title).toBe('发布失败')
		expect(msg.content).toContain('build-and-deploy / Run backend tests')
		expect(msg.content).toContain('ERROR: Process completed')
		expect(msg.content).toContain('actions/runs/99')
	})
})
