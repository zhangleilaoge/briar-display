/** 统计 Markdown 正文字数（CJK 字符 + 拉丁词）与预计阅读时长（按 400 字/分钟） */
export function getReadingStats(md = ''): { words: number; minutes: number } {
	const plain = md
		.replace(/```[\s\S]*?```/g, ' ') // 代码块不计
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // 图片不计
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接保留文字
		.replace(/[#>*`~|]/g, ' ')
	const cjk = (plain.match(/[一-鿿]/g) || []).length
	const latin = (plain.replace(/[一-鿿]/g, ' ').match(/[a-zA-Z0-9]+/g) || []).length
	const words = cjk + latin
	return { words, minutes: Math.max(1, Math.ceil(words / 400)) }
}

export function formatDate(date: Date): string {
	return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`
}

export function formatDateShort(date: Date): string {
	const m = String(date.getMonth() + 1).padStart(2, '0')
	const d = String(date.getDate()).padStart(2, '0')
	return `${date.getFullYear()}.${m}.${d}`
}
