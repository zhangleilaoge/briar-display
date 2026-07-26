import { beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import {
	getCacheDir,
	loadImagesCache,
	loadTextTablesCache,
	saveImagesCache,
	saveTextTablesCache,
} from './cache.ts'
import type { ImageItem, TableChunk, TextChunk } from './types.ts'

describe('cache', () => {
	const tmpDir = `/tmp/bid-compare-cache-test-${Date.now()}`

	beforeEach(() => {
		fs.mkdirSync(tmpDir, { recursive: true })
	})

	it('文本/表格缓存可读写', () => {
		const pdfPath = path.join(tmpDir, 'test.pdf')
		fs.writeFileSync(pdfPath, 'fake pdf')

		const chunks: TextChunk[] = [{ id: 'a', doc: 0, page: 1, text: 'hello' }]
		const tables: TableChunk[] = [{ doc: 0, page: 1, rows: [['a']], rowCount: 1, colCount: 1 }]

		saveTextTablesCache(getCacheDir(tmpDir), pdfPath, 0, chunks, tables)
		const loaded = loadTextTablesCache(getCacheDir(tmpDir), pdfPath, 0)

		expect(loaded).not.toBeNull()
		expect(loaded?.chunks).toEqual(chunks)
		expect(loaded?.tables).toEqual(tables)
	})

	it('PDF 修改后缓存失效', () => {
		const pdfPath = path.join(tmpDir, 'test.pdf')
		fs.writeFileSync(pdfPath, 'fake pdf')

		saveTextTablesCache(getCacheDir(tmpDir), pdfPath, 0, [], [])
		fs.writeFileSync(pdfPath, 'changed')

		const loaded = loadTextTablesCache(getCacheDir(tmpDir), pdfPath, 0)
		expect(loaded).toBeNull()
	})

	it('图片缓存可读写，图片文件缺失则失效', () => {
		const imagesDir = path.join(tmpDir, 'images')
		fs.mkdirSync(imagesDir, { recursive: true })
		const imgPath = path.relative(tmpDir, path.join(imagesDir, 'img.jpg'))
		fs.writeFileSync(path.join(tmpDir, imgPath), 'fake image')

		const images: ImageItem[] = [
			{ doc: 0, page: 1, idx: 1, width: 8, height: 8, base64: '', imgPath, embedding: [1, 2] },
		]

		saveImagesCache(tmpDir, images)
		expect(loadImagesCache(tmpDir)).toEqual(images)

		fs.unlinkSync(path.join(tmpDir, imgPath))
		expect(loadImagesCache(tmpDir)).toBeNull()
	})
})
