// 文本块
export interface TextChunk {
	/** 跨文档唯一 ID，用于文本对/非标段落引用 */
	id: string
	doc: number
	page: number
	text: string
}

// 结构化表格
export interface TableChunk {
	doc: number
	page: number
	rows: string[][]
	rowCount: number
	colCount: number
}

// 表格相似对
export interface TablePair {
	sim: number
	docA: number
	pageA: number
	docB: number
	pageB: number
	shapeSim: number
	cellSim: number
	rowsA: string[][]
	rowsB: string[][]
	diffRows: {
		index: number
		type: 'eq' | 'mod' | 'del' | 'ins'
		cellsA: string[]
		cellsB: string[]
	}[]
}

// 图片各阶段类型（状态机）
export interface ImageItemExtracted {
	doc: number
	page: number
	idx: number
	width: number
	height: number
	base64: string
}

export interface ImageItemSaved extends ImageItemExtracted {
	/** 图片在输出目录中的相对路径 */
	imgPath: string
}

export interface ImageItem extends ImageItemSaved {
	embedding: number[]
}

// 图片相似对
export interface ImagePair {
	sim: number
	docA: number
	pageA: number
	docB: number
	pageB: number
	wA: number
	hA: number
	wB: number
	hB: number
	/** 图片 A 在输出目录中的相对路径 */
	imgPathA: string
	/** 图片 B 在输出目录中的相对路径 */
	imgPathB: string
}

// 图片相似组（用于把跨文档/同文档的重复图聚合展示）
// 报告展示用的轻量图片信息（不含 base64/embedding）
export interface ImageItemDisplay {
	doc: number
	page: number
	idx: number
	width: number
	height: number
	imgPath: string
	/** 同一 group 内与该图最相似的 Top5（用于前端“选中高亮”交互） */
	topSimilar?: { imgPath: string; sim: number }[]
}

export interface ImageGroup {
	id: number
	size: number
	docs: number[]
	repA: ImageItemDisplay
	repB: ImageItemDisplay
	repSim: number
	itemsByDoc: { doc: number; items: ImageItemDisplay[] }[]
}

// 文本相似对（通过 chunk id 引用全文，避免重复存储）
export interface TextPair {
	sim: number
	docA: number
	pageA: number
	chunkAId: string
	docB: number
	pageB: number
	chunkBId: string
}

// 非标段落（通过 chunk id 引用全文）
export interface SpecialParagraph {
	doc: number
	page: number
	chunkId: string
	score: number
	models: string[]
	rareGrams: string[]
}

// 比对结果
export interface CompareResult {
	config: {
		chunkSize: number
		imgThreshold: number
		textThreshold: number
		tableThreshold: number
	}
	docNames: string[]
	allChunks: TextChunk[]
	allTables: TableChunk[]
	imgPairs: ImagePair[]
	imgGroups: ImageGroup[]
	textPairs: TextPair[]
	tablePairs: TablePair[]
	specialParas: SpecialParagraph[]
}

// CLI 参数
export interface CliOptions {
	docs?: string[]
	output: string
	imgThreshold: number
	textThreshold: number
	tableThreshold: number
	chunkSize: number
	imgMinArea: number
	imgGroupThreshold: number
	resume: boolean
	outputFormat: 'json' | 'msgpack'
}
