import { type WikiRecord, wikiDal } from '../dal/wikiDal'

/**
 * 将字符串转换为 URL 友好的 slug
 * 例如: "Hello World" -> "hello-world"
 */
const generateSlug = (title: string): string => {
	return title
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '') // 移除特殊字符
		.replace(/[\s_-]+/g, '-') // 将空格和下划线转换为连字符
		.replace(/^-+|-+$/g, '') // 移除开头和结尾的连字符
}

/**
 * 确保 slug 唯一性，如果冲突则追加数字
 */
const ensureUniqueSlug = async (titleSlug: string, excludeId?: string): Promise<string> => {
	let slug = titleSlug
	let counter = 1

	while (true) {
		const existing = await wikiDal.findBySlug(slug)
		if (!existing || existing.id === excludeId) {
			return slug
		}
		slug = `${titleSlug}-${counter}`
		counter++
	}
}

/**
 * 从内容生成摘要（前 500 字）
 */
const generateSummary = (content: string): string => {
	// 移除 markdown 语法
	const plainText = content
		.replace(/[#*`_\[\]()~]/g, '')
		.replace(/\n\n+/g, ' ')
		.trim()

	return plainText.substring(0, 500)
}

export interface CreateWikiInput {
	title: string
	content: string
	status: 'draft' | 'published'
	authorId: string
}

export interface UpdateWikiInput {
	title?: string
	content?: string
	status?: 'draft' | 'published'
}

export const wikiService = {
	/**
	 * 获取已发布的文章列表
	 */
	async getPublishedList(limit = 20, offset = 0) {
		return wikiDal.list(limit, offset)
	},

	/**
	 * 获取用户自己的所有文章（包括草稿）
	 */
	async getUserWikis(authorId: string) {
		return wikiDal.listByAuthor(authorId)
	},

	/**
	 * 按 slug 获取文章详情
	 */
	async getBySlug(slug: string) {
		return wikiDal.findBySlug(slug)
	},

	/**
	 * 按 ID 获取文章详情
	 */
	async getById(id: string) {
		return wikiDal.findById(id)
	},

	/**
	 * 创建新文章
	 */
	async create(input: CreateWikiInput): Promise<WikiRecord> {
		// 验证输入
		if (!input.title || input.title.trim().length === 0) {
			throw new Error('INVALID_TITLE')
		}
		if (!input.content || input.content.trim().length === 0) {
			throw new Error('INVALID_CONTENT')
		}
		if (!input.authorId) {
			throw new Error('INVALID_AUTHOR')
		}

		// 生成 slug
		const titleSlug = generateSlug(input.title)
		const slug = await ensureUniqueSlug(titleSlug)

		// 生成摘要
		const summary = generateSummary(input.content)

		// 创建文章
		return wikiDal.create({
			title: input.title,
			slug,
			content: input.content,
			summary: summary || null,
			authorId: input.authorId,
			status: input.status,
		})
	},

	/**
	 * 更新文章
	 */
	async update(id: string, input: UpdateWikiInput, currentUserId: string): Promise<WikiRecord> {
		// 获取原文章
		const wiki = await wikiDal.findById(id)
		if (!wiki) {
			throw new Error('NOT_FOUND')
		}

		// 权限检查：只有作者可以编辑
		if (wiki.authorId !== currentUserId) {
			throw new Error('FORBIDDEN')
		}

		// 验证输入
		if (input.title !== undefined && input.title.trim().length === 0) {
			throw new Error('INVALID_TITLE')
		}
		if (input.content !== undefined && input.content.trim().length === 0) {
			throw new Error('INVALID_CONTENT')
		}

		// 如果标题改变，重新生成 slug
		const updateData: Parameters<typeof wikiDal.update>[1] = {
			...input,
		}

		if (input.title && input.title !== wiki.title) {
			const newTitleSlug = generateSlug(input.title)
			const newSlug = await ensureUniqueSlug(newTitleSlug, id)
			updateData.slug = newSlug
		}

		// 如果内容改变，重新生成摘要
		if (input.content && input.content !== wiki.content) {
			const newSummary = generateSummary(input.content)
			updateData.summary = newSummary || null
		}

		const updated = await wikiDal.update(id, updateData)
		if (!updated) {
			throw new Error('UPDATE_FAILED')
		}

		return updated
	},

	/**
	 * 删除文章
	 */
	async delete(id: string, currentUserId: string): Promise<boolean> {
		// 获取文章
		const wiki = await wikiDal.findById(id)
		if (!wiki) {
			throw new Error('NOT_FOUND')
		}

		// 权限检查：只有作者可以删除
		if (wiki.authorId !== currentUserId) {
			throw new Error('FORBIDDEN')
		}

		return wikiDal.delete(id)
	},

	/**
	 * 增加浏览次数
	 */
	async addView(id: string): Promise<void> {
		await wikiDal.incrementViewCount(id)
	},
}
