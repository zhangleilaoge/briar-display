import type { WikiDiffLine, WikiDiffResult } from '@briar/shared'
import { diffLines } from 'diff'
import { pageDal } from '../../dal/wiki/pageDal'
import { revisionDal } from '../../dal/wiki/revisionDal'

export const revisionService = {
	/**
	 * Create a revision with auto-incrementing revision number
	 */
	async createRevision(
		pageId: string,
		content: string,
		summary: string | null,
		editorId: string,
		sizeBefore: number,
		sizeAfter: number,
		minorEdit: boolean,
	) {
		const latestRevNum = await revisionDal.getLatestRevisionNumber(pageId)

		return revisionDal.create({
			pageId,
			content,
			summary,
			editorId,
			revisionNumber: latestRevNum + 1,
			sizeBefore,
			sizeAfter,
			minorEdit,
		})
	},

	/**
	 * List revisions for a page by slug
	 */
	async getRevisions(slug: string, limit = 20, offset = 0) {
		const page = await pageDal.findBySlug('main', slug)
		if (!page) {
			throw new Error('PAGE_NOT_FOUND')
		}

		return revisionDal.listByPage(page.id, limit, offset)
	},

	/**
	 * Compute diff between two revisions
	 */
	async getDiff(slug: string, fromRev: number, toRev: number): Promise<WikiDiffResult> {
		const page = await pageDal.findBySlug('main', slug)
		if (!page) {
			throw new Error('PAGE_NOT_FOUND')
		}

		const fromRevision = await revisionDal.getRevision(page.id, fromRev)
		const toRevision = await revisionDal.getRevision(page.id, toRev)

		if (!fromRevision || !toRevision) {
			throw new Error('REVISION_NOT_FOUND')
		}

		const changes = diffLines(fromRevision.content, toRevision.content)

		const lines: WikiDiffLine[] = []
		let additions = 0
		let deletions = 0
		let oldLineNum = 1
		let newLineNum = 1

		for (const change of changes) {
			const changeLines = change.value.split('\n')
			// diffLines may produce a trailing empty string
			if (changeLines[changeLines.length - 1] === '') {
				changeLines.pop()
			}

			for (const line of changeLines) {
				if (change.added) {
					lines.push({
						type: 'added',
						content: line,
						newLineNum: newLineNum++,
					})
					additions++
				} else if (change.removed) {
					lines.push({
						type: 'removed',
						content: line,
						oldLineNum: oldLineNum++,
					})
					deletions++
				} else {
					lines.push({
						type: 'unchanged',
						content: line,
						oldLineNum: oldLineNum++,
						newLineNum: newLineNum++,
					})
				}
			}
		}

		return {
			fromRevision: fromRev,
			toRevision: toRev,
			lines,
			additions,
			deletions,
		}
	},

	/**
	 * Revert to a specific revision
	 */
	async revertToRevision(slug: string, revId: string, userId: string) {
		const page = await pageDal.findBySlug('main', slug)
		if (!page) {
			throw new Error('PAGE_NOT_FOUND')
		}

		const revision = await revisionDal.findById(revId)
		if (!revision || revision.pageId !== page.id) {
			throw new Error('REVISION_NOT_FOUND')
		}

		// Create a new revision with the old content
		const latestRevNum = await revisionDal.getLatestRevisionNumber(page.id)
		const newRevision = await revisionDal.create({
			pageId: page.id,
			content: revision.content,
			summary: `Reverted to revision ${revision.revisionNumber}`,
			editorId: userId,
			revisionNumber: latestRevNum + 1,
			sizeBefore: page.content.length,
			sizeAfter: revision.content.length,
			minorEdit: false,
		})

		// Update the page content
		await pageDal.update(page.id, {
			content: revision.content,
			lastEditorId: userId,
		})

		return newRevision
	},
}
