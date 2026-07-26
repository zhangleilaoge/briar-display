import { spawn } from 'node:child_process'
import path from 'node:path'
import { DEFAULT_CONFIG } from '../config.ts'
import { PythonEnvError, assertPythonPath, enhancePythonError } from '../python-env.ts'
import type { ImageItemExtracted } from '../types.ts'

const ENCODER_DIR = path.join(import.meta.dir, '..', '..', 'python_encoder')
const EXTRACTOR_PATH = path.join(ENCODER_DIR, 'image_extractor.py')

/**
 * 调用 Python PyMuPDF 提取 PDF 图片
 */
function extractViaPython(
	pdfPath: string,
	docIdx: number,
	minSize: number,
	minArea: number,
): Promise<{ doc: number; page: number; idx: number; w: number; h: number; base64: string }[]> {
	return new Promise((resolve, reject) => {
		let pythonPath: string
		try {
			pythonPath = assertPythonPath()
		} catch (err) {
			reject(err)
			return
		}

		const proc = spawn(pythonPath, [EXTRACTOR_PATH], {
			stdio: ['pipe', 'pipe', 'pipe'],
		})

		let stdout = ''
		let stderr = ''

		proc.stdout.on('data', (data: Buffer) => {
			stdout += data.toString()
		})
		proc.stderr.on('data', (data: Buffer) => {
			stderr += data.toString()
		})
		proc.on('close', (code) => {
			if (code !== 0) {
				reject(
					new PythonEnvError(
						`Python image extractor failed (exit ${code}): ${enhancePythonError(stderr)}`,
					),
				)
				return
			}
			try {
				const result = JSON.parse(stdout) as {
					images: { doc: number; page: number; idx: number; w: number; h: number; base64: string }[]
				}
				resolve(result.images)
			} catch (e) {
				reject(new Error(`Failed to parse Python extractor output: ${e}`))
			}
		})
		proc.on('error', reject)

		proc.stdin.write(
			JSON.stringify({ pdf_path: pdfPath, doc_idx: docIdx, min_size: minSize, min_area: minArea }),
		)
		proc.stdin.end()
	})
}

/**
 * 从 PDF 提取图片
 * 使用 Python PyMuPDF 子进程，与原版 Python 行为一致
 */
export async function extractImages(
	pdfPath: string,
	docIdx: number,
	minSize = DEFAULT_CONFIG.IMG_MIN_SIZE,
	minArea = DEFAULT_CONFIG.IMG_MIN_AREA,
): Promise<ImageItemExtracted[]> {
	const images = await extractViaPython(pdfPath, docIdx, minSize, minArea)

	return images.map((img) => ({
		doc: img.doc,
		page: img.page,
		idx: img.idx,
		width: img.w,
		height: img.h,
		base64: img.base64,
	}))
}
