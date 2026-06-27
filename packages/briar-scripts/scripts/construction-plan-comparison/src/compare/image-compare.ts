import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { DEFAULT_CONFIG } from '../config.ts'
import type { ImageItem, ImagePair } from '../types.ts'

const ENCODER_DIR = path.join(import.meta.dir, '..', '..', 'python_encoder')
const ENCODER_PATH = path.join(ENCODER_DIR, 'image_encoder.py')

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
 * 启动 Python 图片编码长驻子进程
 */
function startEncoderProcess(): {
	proc: ReturnType<typeof spawn>
	send: (
		images: { doc: number; page: number; idx: number; base64: string }[],
	) => Promise<{ doc: number; page: number; idx: number; embedding: number[] }[]>
	close: () => Promise<void>
} {
	const pythonPath = resolvePythonPath()

	if (!fs.existsSync(pythonPath) && !pythonPath.includes(path.sep)) {
		throw new Error(
			`未找到 Python 解释器: ${pythonPath}\n请在 python_encoder/ 下创建虚拟环境，或设置 PYTHON_PATH 环境变量指向 Python 可执行文件。`,
		)
	}

	const proc = spawn(pythonPath, [ENCODER_PATH], {
		stdio: ['pipe', 'pipe', 'pipe'],
	})

	let buffer = ''
	const pendingResolvers: {
		resolve: (value: { doc: number; page: number; idx: number; embedding: number[] }[]) => void
		reject: (reason: Error) => void
	}[] = []

	proc.stdout.on('data', (data: Buffer) => {
		buffer += data.toString('utf-8')
		const lines = buffer.split('\n')
		buffer = lines.pop() ?? ''

		for (const line of lines) {
			if (!line.trim()) continue
			try {
				const result = JSON.parse(line) as
					| { status: string; device: string }
					| { embeddings: { doc: number; page: number; idx: number; embedding: number[] }[] }
					| { error: string }

				if ('status' in result) {
					// 忽略 ready 状态消息
					continue
				}

				if ('error' in result) {
					const pending = pendingResolvers.shift()
					pending?.reject(new Error(`Python encoder error: ${result.error}`))
					continue
				}

				const pending = pendingResolvers.shift()
				if (pending) {
					pending.resolve(result.embeddings ?? [])
				}
			} catch (e) {
				const pending = pendingResolvers.shift()
				pending?.reject(new Error(`Failed to parse Python encoder output: ${e}`))
			}
		}
	})

	let stderr = ''
	proc.stderr.on('data', (data: Buffer) => {
		stderr += data.toString('utf-8')
	})

	proc.on('error', (err) => {
		for (const pending of pendingResolvers.splice(0)) {
			pending.reject(err)
		}
	})

	proc.on('close', (code) => {
		if (code !== 0) {
			const err = new Error(`Python encoder exited with code ${code}: ${stderr}`)
			for (const pending of pendingResolvers.splice(0)) {
				pending.reject(err)
			}
		}
	})

	return {
		proc,
		send(images) {
			return new Promise((resolve, reject) => {
				pendingResolvers.push({ resolve, reject })
				proc.stdin.write(`${JSON.stringify({ images })}\n`)
			})
		},
		close() {
			return new Promise((resolve, reject) => {
				proc.stdin.end()
				proc.on('close', (code) => {
					if (code === 0) {
						resolve()
					} else {
						reject(new Error(`Python encoder exited with code ${code}: ${stderr}`))
					}
				})
			})
		},
	}
}

/**
 * 将图片编码为特征向量
 */
export async function encodeImages(
	images: Omit<ImageItem, 'embedding'>[],
	batchSize = DEFAULT_CONFIG.BATCH_SIZE,
): Promise<ImageItem[]> {
	if (images.length === 0) {
		return []
	}

	const encoder = startEncoderProcess()
	const results: ImageItem[] = []

	try {
		for (let i = 0; i < images.length; i += batchSize) {
			const batch = images.slice(i, i + batchSize)
			console.log(
				`  编码图片 ${i + 1}-${Math.min(i + batchSize, images.length)}/${images.length}...`,
			)

			const embeddings = await encoder.send(batch)

			// 将 embedding 匹配回原始图片
			for (const img of batch) {
				const emb = embeddings.find(
					(e) => e.doc === img.doc && e.page === img.page && e.idx === img.idx,
				)
				if (emb) {
					results.push({
						...img,
						embedding: emb.embedding,
					})
				}
			}
		}
	} finally {
		await encoder.close()
	}

	return results
}

/**
 * 余弦相似度
 */
function cosineSimilarity(a: number[], b: number[]): number {
	let dot = 0
	let normA = 0
	let normB = 0
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}
	return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8)
}

/**
 * 图片跨文档相似度比对
 */
export function compareImages(
	images: ImageItem[],
	threshold = DEFAULT_CONFIG.IMG_THRESHOLD,
): ImagePair[] {
	const pairs: ImagePair[] = []

	for (let i = 0; i < images.length; i++) {
		for (let j = i + 1; j < images.length; j++) {
			// 只比较不同文档的图片
			if (images[i].doc === images[j].doc) continue

			const sim = cosineSimilarity(images[i].embedding, images[j].embedding)
			if (sim < threshold) continue

			pairs.push({
				sim: Math.round(sim * 10000) / 10000,
				docA: images[i].doc,
				pageA: images[i].page,
				docB: images[j].doc,
				pageB: images[j].page,
				wA: images[i].width,
				hA: images[i].height,
				wB: images[j].width,
				hB: images[j].height,
				imgPathA: images[i].imgPath,
				imgPathB: images[j].imgPath,
			})
		}
	}

	pairs.sort((a, b) => b.sim - a.sim)
	return pairs
}
