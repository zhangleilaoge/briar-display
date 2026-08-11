'use client'

import type { WikiBacklink } from '@briar/shared'
import { RefreshCw } from 'lucide-react'

interface ArticleBacklinksProps {
	backlinks: WikiBacklink[]
}

export default function ArticleBacklinks({ backlinks }: ArticleBacklinksProps) {
	if (!backlinks || backlinks.length === 0) return null

	return (
		<div className="border-t border-wiki-border-light pt-4">
			<h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-wiki-text">
				<RefreshCw className="h-4 w-4 text-wiki-text-muted" />
				被引用
			</h3>
			<ul className="flex flex-wrap gap-x-4 gap-y-1">
				{backlinks.map((bl) => (
					<li key={bl.id}>
						<a
							href={`/briar/wiki/${bl.sourceSlug}`}
							className="text-[13px] text-wiki-link hover:underline"
						>
							{bl.sourceSlug}
						</a>
					</li>
				))}
			</ul>
		</div>
	)
}
