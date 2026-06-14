declare module 'pdf-parse' {
	function pdfParse(data: Buffer): Promise<{ text: string; numpages: number; info: unknown }>
	export default pdfParse
}
