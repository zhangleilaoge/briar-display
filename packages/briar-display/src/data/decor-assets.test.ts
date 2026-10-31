import { describe, expect, test } from 'bun:test'
import { readdir } from 'node:fs/promises'
import { ARCANE_DECOR, DECOR_GROUPS, SCRAPBOOK_DECOR } from './decor-assets'

describe('装饰素材目录', () => {
	test('画廊完整收录本地素材，且路径和引用地址均不重复', async () => {
		const localAssets = await Promise.all(
			['', 'stationery-stickers/', 'ribbon-stickers/'].map(async (directory) => {
				const files = await readdir(new URL(`../assets/decor/${directory}`, import.meta.url))
				return files
					.filter((file) => /\.(png|svg)$/.test(file))
					.map((file) => `${directory}${file}`)
			}),
		)
		const galleryAssets = DECOR_GROUPS.flatMap(({ assets }) => assets)

		expect(galleryAssets).toHaveLength(50)
		expect(new Set(galleryAssets.map(({ path }) => path)).size).toBe(galleryAssets.length)
		expect(new Set(galleryAssets.map(({ src }) => src)).size).toBe(galleryAssets.length)
		expect(galleryAssets.map(({ path }) => path).sort()).toEqual(localAssets.flat().sort())
	})

	test('随机贴纸与画廊共用完整的两套素材', () => {
		expect(DECOR_GROUPS[0].assets).toBe(SCRAPBOOK_DECOR)
		expect(DECOR_GROUPS[1].assets).toBe(ARCANE_DECOR)
		expect(SCRAPBOOK_DECOR).toHaveLength(20)
		expect(ARCANE_DECOR).toHaveLength(20)
	})
})
