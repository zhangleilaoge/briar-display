import { defineCollection, z } from 'astro:content'
import { docsSchema } from '@astrojs/starlight/schema'
import { glob } from 'astro/loaders'

const docsCollection = defineCollection({
	schema: docsSchema(),
})

/** 个人博客：纯静态 Markdown，构建期生成页面，无需登录 */
const blogCollection = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
	schema: z.object({
		title: z.string(),
		date: z.coerce.date(),
		description: z.string().optional(),
		tags: z.array(z.string()).default([]),
		draft: z.boolean().default(false),
	}),
})

export const collections = {
	docs: docsCollection,
	blog: blogCollection,
}
