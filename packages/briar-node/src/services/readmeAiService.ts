import { type ReadmeAiRecord, readmeAiDal } from '../dal/readmeAiDal'

export interface InitReadmeAiInput {
	projectPath: string
	projectName: string
	content: string
	codeHash?: string
}

export interface RewriteReadmeAiInput {
	projectPath: string
	content: string
	codeHash?: string
}

export const readmeAiService = {
	/**
	 * 根据项目路径获取 readme.ai.md 记录
	 */
	async getByProjectPath(projectPath: string): Promise<ReadmeAiRecord | null> {
		return readmeAiDal.findByProjectPath(projectPath)
	},

	/**
	 * 根据项目名称获取 readme.ai.md 记录
	 */
	async getByProjectName(projectName: string): Promise<ReadmeAiRecord | null> {
		return readmeAiDal.findByProjectName(projectName)
	},

	/**
	 * 初始化项目的 readme.ai.md
	 */
	async init(input: InitReadmeAiInput): Promise<ReadmeAiRecord> {
		const existing = await readmeAiDal.findByProjectPath(input.projectPath)
		if (existing) {
			throw new Error('ALREADY_EXISTS')
		}

		return readmeAiDal.create({
			projectPath: input.projectPath,
			projectName: input.projectName,
			content: input.content,
			codeHash: input.codeHash || null,
		})
	},

	/**
	 * 重写（更新）项目的 readme.ai.md
	 */
	async rewrite(input: RewriteReadmeAiInput): Promise<ReadmeAiRecord> {
		const existing = await readmeAiDal.findByProjectPath(input.projectPath)
		if (!existing) {
			throw new Error('NOT_FOUND')
		}

		const updated = await readmeAiDal.update(existing.id, {
			content: input.content,
			codeHash: input.codeHash || existing.codeHash,
		})

		if (!updated) {
			throw new Error('UPDATE_FAILED')
		}

		return updated
	},

	/**
	 * 删除项目的 readme.ai.md
	 */
	async delete(projectPath: string): Promise<boolean> {
		const existing = await readmeAiDal.findByProjectPath(projectPath)
		if (!existing) {
			throw new Error('NOT_FOUND')
		}

		return readmeAiDal.delete(existing.id)
	},

	/**
	 * 获取所有项目列表（用于管理）
	 */
	async list(limit = 100, offset = 0): Promise<ReadmeAiRecord[]> {
		return readmeAiDal.list(limit, offset)
	},
}
