import { beforeEach, describe, expect, mock, test } from 'bun:test'
import type { DeployHistoryItem } from './deploymentService'

const claimedRuns = new Set<string>()
const claimAttempts: string[] = []
const messages: { userId: string; type: string; title: string; content: string }[] = []

mock.module('../dal/deployRunDal', () => ({
	deployRunDal: {
		async claimSuccessNotify(runId: string) {
			claimAttempts.push(runId)
			if (claimedRuns.has(runId)) return false
			claimedRuns.add(runId)
			return true
		},
	},
}))
mock.module('../dal/roleDal', () => ({
	roleDal: { findByName: async () => ({ id: 'role-admin' }) },
}))
mock.module('../dal/userRoleDal', () => ({
	userRoleDal: { getRoleUserIds: async () => ['admin-1'] },
}))
mock.module('../lib/db', () => ({
	query: async () => [{ id: 'admin-1' }],
}))
mock.module('../dal/messageDal', () => ({
	messageDal: {
		async create(message: (typeof messages)[number]) {
			messages.push(message)
		},
	},
}))

const { deployNotifyService } = await import('./deployNotifyService')

const deployItem = (status: string): DeployHistoryItem => ({
	run: '123',
	commit: 'abcdef012345',
	ref: 'master',
	actor: 'ci',
	status,
	at: '2026-11-10T00:00:00Z',
	workflowPath: '.github/workflows/deploy.yml',
})

beforeEach(() => {
	claimedRuns.clear()
	claimAttempts.length = 0
	messages.length = 0
})

describe('部署结果站内信', () => {
	test('进行中不通知，成功仅通知一次', async () => {
		await deployNotifyService.notifySuccesses([deployItem('in_progress')])
		expect(claimAttempts).toEqual([])
		expect(messages).toEqual([])

		await deployNotifyService.notifySuccesses([deployItem('success')])
		await deployNotifyService.notifySuccesses([deployItem('success')])
		expect(claimAttempts).toEqual(['123', '123'])
		expect(messages).toHaveLength(1)
		expect(messages[0]).toMatchObject({
			userId: 'admin-1',
			type: 'deploy_success',
			title: '发布成功',
		})
	})

	test('非 CDN 流程不通知', async () => {
		await deployNotifyService.notifySuccesses([
			{ ...deployItem('success'), workflowPath: '.github/workflows/deploy-nginx.yml' },
		])
		expect(claimAttempts).toEqual([])
		expect(messages).toEqual([])
	})
})
