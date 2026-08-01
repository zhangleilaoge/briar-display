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
}
