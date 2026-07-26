import fs from 'node:fs'
import path from 'node:path'

/**
 * 将普通报告 HTML 转成单文件 all-in-one 版本：
 * 仅把报告中实际引用到的图片内嵌为 base64 data URI，
 * 接收方无需附带 images/ 文件夹即可直接查看。
 */
export function generateAllInOneHtmlReport(
	html: string,
	outDir: string,
	imagePaths: string[],
): string {
	const imgData: Record<string, string> = {}
	for (const relPath of imagePaths) {
		const filePath = path.join(outDir, relPath)
		if (!fs.existsSync(filePath)) continue
		const buf = fs.readFileSync(filePath)
		const ext = path.extname(relPath).slice(1).toLowerCase()
		const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`
		imgData[relPath] = `data:${mime};base64,${buf.toString('base64')}`
	}

	const dataScript = `<script>const IMG_DATA = ${JSON.stringify(imgData)};</script>`
	// 在第一个 <script> 标签前注入 IMG_DATA
	const firstScriptIdx = html.indexOf('<script>')
	if (firstScriptIdx === -1) return html

	return `${html.slice(0, firstScriptIdx) + dataScript}\n${html.slice(firstScriptIdx)}`
}
