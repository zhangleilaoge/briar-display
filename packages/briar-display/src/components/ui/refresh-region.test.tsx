import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { RefreshRegion } from './refresh-region'

describe('RefreshRegion', () => {
	it('刷新时保留已有内容并显示非阻塞遮罩', () => {
		const html = renderToStaticMarkup(
			<RefreshRegion refreshing label="正在更新列表…">
				<ul>
					<li>原有内容</li>
				</ul>
			</RefreshRegion>,
		)
		expect(html).toContain('原有内容')
		expect(html).toContain('aria-busy="true"')
		expect(html).toContain('正在更新列表…')
		expect(html).toContain('pointer-events-none')
	})

	it('空闲时不显示遮罩，也不替换子树', () => {
		const html = renderToStaticMarkup(
			<RefreshRegion refreshing={false}>
				<p>已有内容</p>
			</RefreshRegion>,
		)
		expect(html).toContain('已有内容')
		expect(html).toContain('aria-busy="false"')
		expect(html).not.toContain('role="status"')
	})
})
