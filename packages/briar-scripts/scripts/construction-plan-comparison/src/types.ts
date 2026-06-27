// 文本块
export interface TextChunk {
	doc: number
	page: number
	text: string
}

// 提取的图片
export interface ImageItem {
	doc: number
	page: number
	idx: number
	width: number
	height: number
	embedding: number[]
	base64: string
	/** 图片在输出目录中的相对路径 */
	imgPath: string
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

// 文本相似对
export interface TextPair {
	sim: number
	docA: number
	pageA: number
	textA: string
	docB: number
	pageB: number
	textB: string
}

// 非标段落
export interface SpecialParagraph {
	doc: number
	page: number
	text: string
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
	}
	docNames: string[]
	allChunks: TextChunk[]
	imgPairs: ImagePair[]
	textPairs: TextPair[]
	specialParas: SpecialParagraph[]
}

// CLI 参数
export interface CliOptions {
	docs?: string[]
	output: string
	imgThreshold: number
	textThreshold: number
	chunkSize: number
}
