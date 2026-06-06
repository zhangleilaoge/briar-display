import { backlinkDal } from '../../dal/wiki/backlinkDal'
import { pageDal } from '../../dal/wiki/pageDal'

/**
 * Extract [[slug|display]] or [[slug]] mentions from markdown content
 * Returns array of { slug, display }
 */
export function extractMentions(content: string): { slug: string; display: string }[] {
	const mentions: { slug: string; display: string }[] = []
	const regex = /\\?\[\\?\[([^\]|]+)(?:\|([^\]]+))?\\?\]\\?\]/g

	for (let match = regex.exec(content); match !== null; match = regex.exec(content)) {
		const slug = match[1].trim().toLowerCase()
		const display = match[2] ? match[2].trim() : match[1].trim()
		mentions.push({ slug, display })
	}

	return mentions
}

/**
 * Extract {{page:slug}} transclusion syntax from markdown content
 */
export function extractTransclusions(content: string): { slug: string }[] {
	const transclusions: { slug: string }[] = []
	const regex = /\{\{page:([^}]+)\}\}/g

	for (let match = regex.exec(content); match !== null; match = regex.exec(content)) {
		transclusions.push({ slug: match[1].trim() })
	}

	return transclusions
}

/**
 * Resolve transclusions in content by replacing {{page:slug}} with actual page content
 */
export async function resolveTransclusions(content: string): Promise<string> {
	const transclusions = extractTransclusions(content)
	let resolved = content

	for (const { slug } of transclusions) {
		const page = await pageDal.findBySlug('main', slug)
		if (page) {
			const placeholder = `{{page:${slug}}}`
			resolved = resolved.replace(
				placeholder,
				`\n\n---\n**引用自 [[${slug}|${page.title}]]：**\n\n${page.content}\n\n---\n`,
			)
		}
	}

	return resolved
}

/**
 * Update backlinks for a page based on its content
 * Clears old backlinks and creates new ones
 */
export async function updateBacklinks(sourcePageId: string, content: string): Promise<void> {
	await backlinkDal.deleteBySourcePage(sourcePageId)

	const mentions = extractMentions(content)
	const seenTargets = new Set<string>()

	for (const { slug } of mentions) {
		if (seenTargets.has(slug)) continue
		seenTargets.add(slug)

		const targetPage = await pageDal.findBySlug('main', slug)
		if (targetPage) {
			const sourcePage = await pageDal.findById(sourcePageId)
			if (sourcePage) {
				await backlinkDal.create({
					sourcePageId,
					targetPageId: targetPage.id,
					sourceSlug: sourcePage.slug,
					targetSlug: targetPage.slug,
				})
			}
		}
	}
}

/**
 * Get backlinks (pages that link to this page)
 */
export async function getBacklinks(targetPageId: string) {
	return backlinkDal.findByTargetPage(targetPageId)
}
