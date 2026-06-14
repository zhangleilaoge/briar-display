import type { DocumentParser } from '../types.js'

export class NodePdfParser implements DocumentParser {
	async parsePdf(buffer: ArrayBuffer | Buffer): Promise<string> {
		let nodeBuffer: Buffer
		if (Buffer.isBuffer(buffer)) {
			nodeBuffer = buffer
		} else if (buffer instanceof ArrayBuffer) {
			nodeBuffer = Buffer.from(buffer)
		} else {
			throw new Error('Unsupported buffer type')
		}

		const pdfParse = await import('pdf-parse')
		const result = await pdfParse.default(nodeBuffer)
		return result.text ?? ''
	}
}
