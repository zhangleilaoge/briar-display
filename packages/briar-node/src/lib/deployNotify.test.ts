import { describe, expect, test } from 'bun:test'
import {
	buildDeployFailMessage,
	buildDeployStartMessage,
	isCdnDeployWorkflow,
	isDeployFailedStatus,
	isDeployRunningStatus,
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
	test('running-like', () => {
		expect(isDeployRunningStatus('in_progress')).toBe(true)
		expect(isDeployRunningStatus('queued')).toBe(true)
		expect(isDeployRunningStatus('success')).toBe(false)
		expect(isDeployRunningStatus('failure')).toBe(false)
	})
	test('failed-like', () => {
		expect(isDeployFailedStatus('failure')).toBe(true)
		expect(isDeployFailedStatus('cancelled')).toBe(true)
		expect(isDeployFailedStatus('success')).toBe(false)
		expect(isDeployFailedStatus('in_progress')).toBe(false)
	})
})

describe('message builders', () => {
	test('start message', () => {
		const msg = buildDeployStartMessage({
			runId: '123',
			commit: 'abcdef012345',
			ref: 'master',
			actor: 'zhangleilaoge',
			msg: 'fix: something',
		})
		expect(msg.type).toBe('deploy_start')
		expect(msg.title).toBe('发布开始')
		expect(msg.content).toContain('CDN 部署已开始')
		expect(msg.content).toContain('abcdef0')
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
