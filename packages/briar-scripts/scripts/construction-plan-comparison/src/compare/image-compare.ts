import { spawn } from 'node:child_process'
import path from 'node:path'
import { DEFAULT_CONFIG } from '../config.ts'
import type { Logger } from '../logger.ts'
import { PythonEnvError, assertPythonPath, enhancePythonError } from '../python-env.ts'
import type {
	ImageGroup,
	ImageItem,
	ImageItemDisplay,
	ImageItemSaved,
	ImagePair,
} from '../types.ts'

const ENCODER_DIR = path.join(import.meta.dir, '..', '..', 'python_encoder')
const ENCODER_PATH = path.join(ENCODER_DIR, 'image_encoder.py')

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
	const pythonPath = assertPythonPath()

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
			const err = new PythonEnvError(
				`Python encoder exited with code ${code}: ${enhancePythonError(stderr)}`,
			)
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
	images: ImageItemSaved[],
	batchSize = DEFAULT_CONFIG.BATCH_SIZE,
	logger?: Logger,
): Promise<ImageItem[]> {
	if (images.length === 0) {
		return []
	}

	const encoder = startEncoderProcess()
	const results: ImageItem[] = []

	try {
		// 流水线发送 batch（最多 3 个并发），减少 IPC 等待同时避免内存峰值
		const concurrency = 3
		const batches: { index: number; batch: typeof images }[] = []
		for (let i = 0; i < images.length; i += batchSize) {
			batches.push({ index: i, batch: images.slice(i, i + batchSize) })
		}

		const allResults: {
			batch: typeof images
			embeddings: { doc: number; page: number; idx: number; embedding: number[] }[]
		}[] = []
		for (let i = 0; i < batches.length; i += concurrency) {
			const slice = batches.slice(i, i + concurrency)
			const sliceResults = await Promise.all(
				slice.map(({ index, batch }) =>
					encoder.send(batch).then((embeddings) => {
						const msg = `  编码图片 ${index + 1}-${Math.min(index + batchSize, images.length)}/${images.length}...`
						if (logger) logger.info(msg)
						else console.log(msg)
						return { batch, embeddings }
					}),
				),
			)
			allResults.push(...sliceResults)
		}

		for (const { batch, embeddings } of allResults) {
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

		if (results.length !== images.length) {
			const msg = `  警告: ${images.length - results.length} 张图片编码失败`
			if (logger) logger.warn(msg)
			else console.warn(msg)
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

/**
 * 向量归一化（用于加速大规模点积）
 */
function normalizeVector(vec: number[]): number[] {
	let norm = 0
	for (const v of vec) norm += v * v
	const inv = 1 / (Math.sqrt(norm) + 1e-8)
	return vec.map((v) => v * inv)
}

/**
 * 点积（要求输入向量已归一化，结果即余弦相似度）
 */
function dotProduct(a: number[], b: number[]): number {
	let dot = 0
	for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
	return dot
}

class UnionFind {
	parent: number[]
	rank: number[]
	constructor(n: number) {
		this.parent = Array.from({ length: n }, (_, i) => i)
		this.rank = new Array(n).fill(0)
	}
	find(x: number): number {
		let root = x
		while (this.parent[root] !== root) root = this.parent[root]
		let cur = x
		while (this.parent[cur] !== root) {
			const next = this.parent[cur]
			this.parent[cur] = root
			cur = next
		}
		return root
	}
	union(a: number, b: number): void {
		const ra = this.find(a)
		const rb = this.find(b)
		if (ra === rb) return
		if (this.rank[ra] < this.rank[rb]) {
			this.parent[ra] = rb
		} else if (this.rank[ra] > this.rank[rb]) {
			this.parent[rb] = ra
		} else {
			this.parent[rb] = ra
			this.rank[ra]++
		}
	}
}

/**
 * 对相似图片进行聚类（包含同文档内重复图）
 */
export function groupImages(
	images: ImageItem[],
	threshold = DEFAULT_CONFIG.IMG_GROUP_THRESHOLD,
): ImageGroup[] {
	if (images.length < 2) return []

	const norms = images.map((img) => normalizeVector(img.embedding))
	const uf = new UnionFind(images.length)
	const pairSims: { i: number; j: number; sim: number }[] = []

	for (let i = 0; i < images.length; i++) {
		for (let j = i + 1; j < images.length; j++) {
			const sim = dotProduct(norms[i], norms[j])
			if (sim < threshold) continue
			uf.union(i, j)
			pairSims.push({ i, j, sim: Math.round(sim * 10000) / 10000 })
		}
	}

	// 收集簇
	const clusters = new Map<number, number[]>()
	for (let i = 0; i < images.length; i++) {
		const root = uf.find(i)
		if (!clusters.has(root)) clusters.set(root, [])
		clusters.get(root)!.push(i)
	}

	const toDisplay = (img: ImageItem): ImageItemDisplay => ({
		doc: img.doc,
		page: img.page,
		idx: img.idx,
		width: img.width,
		height: img.height,
		imgPath: img.imgPath,
	})

	const groups: ImageGroup[] = []
	let gid = 0
	for (const [, members] of clusters) {
		if (members.length < 2) continue

		// 为每个成员创建一次展示对象，后续 rep 和 items 共用
		const idxToDisplay = new Map<number, ImageItemDisplay>()
		for (const idx of members) {
			idxToDisplay.set(idx, toDisplay(images[idx]))
		}

		// 在簇内找最佳代表对，优先跨文档
		const memberSet = new Set(members)
		let bestCross: { i: number; j: number; sim: number } | null = null
		let bestSame: { i: number; j: number; sim: number } | null = null
		for (const p of pairSims) {
			if (!memberSet.has(p.i) || !memberSet.has(p.j)) continue
			if (images[p.i].doc === images[p.j].doc) {
				if (!bestSame || p.sim > bestSame.sim) bestSame = p
			} else {
				if (!bestCross || p.sim > bestCross.sim) bestCross = p
			}
		}
		const best = bestCross ?? bestSame
		if (!best) continue

		// 计算组内每张图最相似的 TopK（K = min(9, groupSize/3)，至少取 1）
		const topK = Math.max(1, Math.min(9, Math.floor(members.length / 3)))
		for (const mi of members) {
			const sims: { imgPath: string; sim: number }[] = []
			for (const mj of members) {
				if (mi === mj) continue
				sims.push({
					imgPath: images[mj].imgPath,
					sim: Math.round(dotProduct(norms[mi], norms[mj]) * 10000) / 10000,
				})
			}
			sims.sort((a, b) => b.sim - a.sim)
			idxToDisplay.get(mi)!.topSimilar = sims.slice(0, topK)
		}

		// 按文档分组
		const byDoc = new Map<number, ImageItemDisplay[]>()
		for (const idx of members) {
			const d = idxToDisplay.get(idx)!
			if (!byDoc.has(d.doc)) byDoc.set(d.doc, [])
			byDoc.get(d.doc)!.push(d)
		}
		const itemsByDoc = Array.from(byDoc.entries())
			.map(([doc, items]) => ({ doc, items: items.sort((a, b) => a.page - b.page) }))
			.sort((a, b) => a.doc - b.doc)

		groups.push({
			id: gid++,
			size: members.length,
			docs: itemsByDoc.map((d) => d.doc),
			repA: idxToDisplay.get(best.i)!,
			repB: idxToDisplay.get(best.j)!,
			repSim: best.sim,
			itemsByDoc,
		})
	}

	groups.sort((a, b) => b.repSim - a.repSim)
	return groups
}
