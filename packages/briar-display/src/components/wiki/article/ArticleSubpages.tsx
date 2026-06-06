'use client'

import type { WikiPageSummary } from '@briar/shared'
import { FileText } from 'lucide-react'

interface ArticleSubpagesProps {
	subpages: WikiPageSummary[]
}

export default function ArticleSubpages({ subpages }: ArticleSubpagesProps) {
	if (!subpages || subpages.length === 0) return null

	return (
		<div className="border-t border-wiki-border-light pt-4">
			<h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-wiki-text">
				<FileText className="h-4 w-4 text-wiki-text-muted" />
				子页面
			</h3>
			<ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
				{subpages.map((sp) => (
					<li key={sp.id}>
						<a
							href={`/briar-display/wiki/${sp.slug}`}
							className="inline-flex items-center gap-1.5 text-[13px] text-wiki-link hover:underline"
						>
							<FileText className="h-3.5 w-3.5" />
							{sp.title}
						</a>
					</li>
				))}
			</ul>
		</div>
	)
}
