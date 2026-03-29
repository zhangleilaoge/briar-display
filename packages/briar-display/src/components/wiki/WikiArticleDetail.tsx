'use client'

import type { WikiArticle } from '@/api/wiki'
import { wikiApi } from '@/api/wiki'
import { Button } from '@/components/ui/button'
import React, { useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import WikiHeader from './WikiHeader'

interface WikiArticleDetailProps {
	article: WikiArticle
	onBack: () => void
	onEdit?: () => void
}

export default function WikiArticleDetail({ article, onBack, onEdit }: WikiArticleDetailProps) {
	useEffect(() => {
		// Increment view count
		wikiApi.addView(article.id).catch(console.error)
	}, [article.id])

	const updatedDate = new Date(article.updatedAt)
	const formattedDate = updatedDate.toLocaleDateString('zh-CN', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	})

	return (
		<div className="w-full max-w-4xl mx-auto p-4">
			<WikiHeader
				title={article.title}
				showAction={{
					label: '← Back to Articles',
					onClick: onBack,
				}}
			/>

			{/* Article Header */}
			<article className="bg-white rounded-lg border border-gray-200 p-8">
				<header className="mb-8 pb-8 border-b border-gray-200">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-6">
							<span>👁️ {article.viewCount} views</span>
							<span>Updated: {formattedDate}</span>
						</div>
						<div className="flex gap-3">
							<span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
								{article.status === 'published' ? 'Published' : 'Draft'}
							</span>
							{onEdit && (
								<Button onClick={onEdit} size="sm">
									✎ Edit
								</Button>
							)}
						</div>
					</div>
				</header>

				{/* Article Content */}
				<div className="prose prose-sm max-w-none mb-8">
					<ReactMarkdown
						components={{
							h1: ({ node, ...props }) => <h1 className="text-3xl font-bold" {...props} />,
							h2: ({ node, ...props }) => <h2 className="text-2xl font-bold" {...props} />,
							h3: ({ node, ...props }) => <h3 className="text-xl font-bold" {...props} />,
							p: ({ node, ...props }) => <p className="text-gray-700 leading-relaxed" {...props} />,
							ul: ({ node, ...props }) => (
								<ul className="list-disc list-inside text-gray-700" {...props} />
							),
							ol: ({ node, ...props }) => (
								<ol className="list-decimal list-inside text-gray-700" {...props} />
							),
							code: ({ node, inline, ...props }) =>
								inline ? (
									<code
										className="bg-gray-100 px-2 py-1 rounded text-red-600 font-mono text-sm"
										{...props}
									/>
								) : (
									<code
										className="block bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto font-mono text-sm my-2"
										{...props}
									/>
								),
							pre: ({ node, ...props }) => (
								<pre
									className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-2"
									{...props}
								/>
							),
							blockquote: ({ node, ...props }) => (
								<blockquote
									className="border-l-4 border-blue-500 pl-4 italic text-gray-700 my-2"
									{...props}
								/>
							),
							a: ({ node, ...props }) => (
								<a className="text-blue-600 hover:text-blue-800 underline" {...props} />
							),
							table: ({ node, ...props }) => (
								<table className="w-full border-collapse border border-gray-300 my-2" {...props} />
							),
							td: ({ node, ...props }) => (
								<td className="border border-gray-300 px-4 py-2" {...props} />
							),
							th: ({ node, ...props }) => (
								<th className="border border-gray-300 px-4 py-2 bg-gray-100 font-bold" {...props} />
							),
						}}
					>
						{article.content}
					</ReactMarkdown>
				</div>

				{/* Footer */}
				<footer className="pt-8 border-t border-gray-200 text-sm text-gray-600">
					<p>Article ID: {article.id}</p>
					<p>Created: {new Date(article.createdAt).toLocaleDateString()}</p>
				</footer>
			</article>
		</div>
	)
}
