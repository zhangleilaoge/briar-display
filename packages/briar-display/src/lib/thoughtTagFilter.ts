/** 想法多标签筛选的小工具（纯函数，便于测试） */

/** 多选切换：已选中则移除，否则追加到末尾 */
export function toggleTagInList(list: readonly string[], tag: string): string[] {
	return list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]
}

/** 展示用：#a、#b、#c（默认顿号分隔） */
export function formatTagList(tags: readonly string[], sep = '、'): string {
	return tags.map((t) => `#${t}`).join(sep)
}
