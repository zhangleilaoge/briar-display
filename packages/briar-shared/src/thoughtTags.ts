/**
 * 想法 #标签 解析（前后端共用）。
 * 规则：`#` 前必须是行首 / 空白 / 标点（不能紧跟字母数字，避免 a#b、URL 片段）；
 * 标签字符为任意语言字母、数字、下划线（含中日韩），遇空白或标点即止；最长 32 字。
 * http(s) URL 内部的 `#fragment` 不算标签。
 */

export const THOUGHT_TAG_MAX_LENGTH = 32

export type TagTextPart =
	| { type: 'text'; value: string }
	| { type: 'tag'; tag: string; value: string }

const URL_RE = /https?:\/\/[a-zA-Z0-9][a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]*/gi
const TAG_RE = /(^|[^\p{L}\p{N}_#&/])#([\p{L}\p{N}_]{1,32})(?![\p{L}\p{N}_])/gu

/** 统一大小写（拉丁字母小写），用于存储与筛选 */
export function normalizeThoughtTag(tag: string): string {
	return tag.trim().replace(/^#+/, '').toLowerCase().slice(0, THOUGHT_TAG_MAX_LENGTH)
}

/** 切分不含 URL 的纯文本片段为 text / tag */
export function splitTagText(text: string): TagTextPart[] {
	const parts: TagTextPart[] = []
	let last = 0
	for (const m of text.matchAll(TAG_RE)) {
		const start = (m.index ?? 0) + m[1]!.length
		if (start > last) parts.push({ type: 'text', value: text.slice(last, start) })
		parts.push({ type: 'tag', tag: normalizeThoughtTag(m[2]!), value: `#${m[2]}` })
		last = start + 1 + m[2]!.length
	}
	if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })
	return parts
}

/** 从正文提取去重后的规范化标签（保持首次出现顺序） */
export function extractThoughtTags(body: string): string[] {
	const withoutUrls = (body || '').replace(URL_RE, ' ')
	const seen = new Set<string>()
	for (const p of splitTagText(withoutUrls)) {
		if (p.type === 'tag' && p.tag) seen.add(p.tag)
	}
	return [...seen]
}
