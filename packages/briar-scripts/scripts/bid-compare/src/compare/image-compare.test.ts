import { beforeAll, describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { findPythonPath } from '../python-env.ts'
import type { ImageItem, ImageItemSaved } from '../types.ts'
import { compareImages, encodeImages } from './image-compare.ts'

let RED_IMG_B64 = ''
let BLUE_IMG_B64 = ''
let FIXTURES_DIR = ''

beforeAll(async () => {
	// 动态生成 tiny JPEG 测试图片（使用项目 venv，跨平台）
	const proc = Bun.spawn([
		findPythonPath(),
		'-c',
		`
import base64, io, json
from PIL import Image
fixtures = {}
for name, color in [('red', 'red'), ('blue', 'blue')]:
    img = Image.new('RGB', (8, 8), color=color)
    buf = io.BytesIO()
    img.save(buf, format='JPEG')
    fixtures[name] = base64.b64encode(buf.getvalue()).decode()
print(json.dumps(fixtures))
`,
	])
	const output = await new Response(proc.stdout).text()
	const err = await new Response(proc.stderr).text()
	const code = await proc.exited
	if (code !== 0) {
		throw new Error(`Failed to generate test fixtures: ${err}`)
	}
	const fixtures = JSON.parse(output) as { red: string; blue: string }
	RED_IMG_B64 = fixtures.red
	BLUE_IMG_B64 = fixtures.blue

	// 把 base64 fixture 写入临时文件，encoder 现在通过文件路径读取图片
	FIXTURES_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'bid-compare-image-test-'))
	fs.mkdirSync(path.join(FIXTURES_DIR, 'images'), { recursive: true })
	fs.writeFileSync(
		path.join(FIXTURES_DIR, 'images', 'doc1_page1_idx1.jpg'),
		Buffer.from(RED_IMG_B64, 'base64'),
	)
	fs.writeFileSync(
		path.join(FIXTURES_DIR, 'images', 'doc2_page1_idx1.jpg'),
		Buffer.from(BLUE_IMG_B64, 'base64'),
	)
})

describe('encodeImages', () => {
	it(
		'长驻 Python 子进程能正常编码图片并返回 embedding',
		async () => {
			const images: ImageItemSaved[] = [
				{
					doc: 0,
					page: 1,
					idx: 1,
					width: 8,
					height: 8,
					base64: RED_IMG_B64,
					imgPath: 'images/doc1_page1_idx1.jpg',
				},
				{
					doc: 1,
					page: 1,
					idx: 1,
					width: 8,
					height: 8,
					base64: BLUE_IMG_B64,
					imgPath: 'images/doc2_page1_idx1.jpg',
				},
			]
			const encoded = await encodeImages(images, 32, undefined, FIXTURES_DIR)
			expect(encoded.length).toBe(2)
			expect(encoded[0].embedding.length).toBeGreaterThan(0)
			expect(encoded[1].embedding.length).toBeGreaterThan(0)
			expect(encoded[0].embedding.length).toBe(encoded[1].embedding.length)
		},
		{ timeout: 20_000 },
	)
})

describe('compareImages', () => {
	it('相同图片跨文档相似度为 1.0', () => {
		const images: ImageItem[] = [
			{
				doc: 0,
				page: 1,
				idx: 1,
				width: 8,
				height: 8,
				embedding: [1, 0, 0],
				base64: '',
				imgPath: '',
			},
			{
				doc: 1,
				page: 1,
				idx: 1,
				width: 8,
				height: 8,
				embedding: [1, 0, 0],
				base64: '',
				imgPath: '',
			},
		]
		const pairs = compareImages(images, 0.7)
		expect(pairs.length).toBe(1)
		expect(pairs[0].sim).toBe(1)
	})

	it('不同文档且差异大的图片不会被检出', () => {
		const images: ImageItem[] = [
			{
				doc: 0,
				page: 1,
				idx: 1,
				width: 8,
				height: 8,
				embedding: [1, 0, 0],
				base64: '',
				imgPath: '',
			},
			{
				doc: 1,
				page: 1,
				idx: 1,
				width: 8,
				height: 8,
				embedding: [0, 1, 0],
				base64: '',
				imgPath: '',
			},
		]
		const pairs = compareImages(images, 0.7)
		expect(pairs.length).toBe(0)
	})

	it('同一文档内的图片不会被比较', () => {
		const images: ImageItem[] = [
			{
				doc: 0,
				page: 1,
				idx: 1,
				width: 8,
				height: 8,
				embedding: [1, 0, 0],
				base64: '',
				imgPath: '',
			},
			{
				doc: 0,
				page: 2,
				idx: 1,
				width: 8,
				height: 8,
				embedding: [1, 0, 0],
				base64: '',
				imgPath: '',
			},
		]
		const pairs = compareImages(images, 0.7)
		expect(pairs.length).toBe(0)
	})
})
