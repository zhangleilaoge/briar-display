'use client'

export default function NotFound() {
	return (
		<div className="flex flex-col items-center justify-center py-24 text-center">
			<h1 className="mb-2 text-[40px] font-light text-wiki-text-muted">404</h1>
			<h2 className="mb-4 text-xl font-medium text-wiki-text">页面不存在</h2>
			<p className="mb-8 max-w-md text-[14px] leading-relaxed text-wiki-text-secondary">
				您访问的页面不存在或已被删除。请检查链接是否正确，或返回 Wiki 首页浏览其他内容。
			</p>
			<a
				href="/briar-display/wiki/"
				className="inline-flex items-center rounded bg-[#3366cc] px-5 py-2 text-[14px] font-medium text-white transition-colors hover:bg-[#2a4b8d]"
			>
				返回 Wiki 首页
			</a>
		</div>
	)
}
