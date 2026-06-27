import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { DEFAULT_CONFIG } from '../config.ts'
import type { ImageItem } from '../types.ts'

const ENCODER_DIR = path.join(import.meta.dir, '..', '..', 'python_encoder')
const EXTRACTOR_PATH = path.join(ENCODER_DIR, 'image_extractor.py')

/**
 * 查找可用的 Python 解释器路径
 * 优先级：PYTHON_PATH 环境变量 > ./python_encoder/.venv/bin/python > python3
 */
function resolvePythonPath(): string {
	const envPath = process.env.PYTHON_PATH
	if (envPath && fs.existsSync(envPath)) {
		return envPath
	}

	const venvPath = path.join(ENCODER_DIR, '.venv', 'bin', 'python')
	if (fs.existsSync(venvPath)) {
		return venvPath
	}

	return 'python3'
}

/**
 * 调用 Python PyMuPDF 提取 PDF 图片
 */
function extractViaPython(
	pdfPath: string,
	docIdx: number,
	minSize: number,
): Promise<{ doc: number; page: number; idx: number; w: number; h: number; base64: string }[]> {
	return new Promise((resolve, reject) => {
		const pythonPath = resolvePythonPath()

		if (!fs.existsSync(pythonPath) && !pythonPath.includes(path.sep)) {
			reject(
				new Error(
					`未找到 Python 解释器: ${pythonPath}\n请在 python_encoder/ 下创建虚拟环境，或设置 PYTHON_PATH 环境变量指向 Python 可执行文件。`,
				),
			)
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
				reject(new Error(`Python image extractor failed (exit ${code}): ${stderr}`))
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

		proc.stdin.write(JSON.stringify({ pdf_path: pdfPath, doc_idx: docIdx, min_size: minSize }))
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
): Promise<Omit<ImageItem, 'embedding'>[]> {
	const images = await extractViaPython(pdfPath, docIdx, minSize)

	return images.map((img) => ({
		doc: img.doc,
		page: img.page,
		idx: img.idx,
		width: img.w,
		height: img.h,
		base64: img.base64,
		// imgPath 由调用方在保存图片后填充
		imgPath: '',
	}))
}
