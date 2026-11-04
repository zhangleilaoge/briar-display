import { describe, expect, it } from 'bun:test'
import type { FileItem } from '@/api/files'
import { renderToStaticMarkup } from 'react-dom/server'
import { NavArrow } from './FileDetailModal'

const file = { id: 1, originalName: 'a.pdf' } as unknown as FileItem

describe('NavArrow', () => {
	it('有相邻文件时可点击且可见', () => {
		const html = renderToStaticMarkup(
			<NavArrow direction="prev" target={file} onNavigate={() => {}} />,
		)
		expect(html).not.toContain('disabled=""')
		expect(html).not.toContain('invisible')
		expect(html).toContain('上一个文件')
	})
	it('到头时隐藏，不会出现点不动的按钮', () => {
		const html = renderToStaticMarkup(
			<NavArrow direction="next" target={null} onNavigate={() => {}} />,
		)
		expect(html).toContain('invisible')
		expect(html).toContain('disabled=""')
	})
})
