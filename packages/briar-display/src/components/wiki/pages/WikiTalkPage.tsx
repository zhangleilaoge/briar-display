'use client'

import { wikiApi } from '@/api/wiki'
import WikiPagination from '@/components/wiki/common/WikiPagination'
import WikiTabs from '@/components/wiki/layout/WikiTabs'
import { cn } from '@/lib/utils'
import type { WikiDiscussion, WikiDiscussionReply } from '@briar/shared'
import {
	AlertCircle,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	Loader2,
	MessageSquare,
	MessageSquarePlus,
	Reply,
	Send,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface WikiTalkPageProps {
	slug: string
}

const PAGE_SIZE = 20

function formatDate(date: Date | string) {
	const d = typeof date === 'string' ? new Date(date) : date
	return d.toLocaleString('zh-CN', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	})
}

function isLoggedIn(): boolean {
	if (typeof window === 'undefined') return false
	return !!localStorage.getItem('briar_token')
}

function ReplyItem({
	slug,
	topicId,
	reply,
	depth = 0,
	onReplyPosted,
}: {
	slug: string
	topicId: string
	reply: WikiDiscussionReply
	depth?: number
	onReplyPosted: () => void
}) {
	const [showReplyForm, setShowReplyForm] = useState(false)
	const [replyContent, setReplyContent] = useState('')
	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const handleSubmitReply = async () => {
		if (!replyContent.trim()) return
		setSubmitting(true)
		setError(null)

		const res = await wikiApi.createReply(slug, topicId, {
			content: replyContent.trim(),
			parentReplyId: reply.id,
		})

		if (res.success) {
			setReplyContent('')
			setShowReplyForm(false)
			onReplyPosted()
		} else {
			setError(res.message || '回复失败')
		}
		setSubmitting(false)
	}

	return (
		<div
			className={cn('border-l-2 border-border/50', depth > 0 && 'ml-4')}
			style={{ marginLeft: `${depth * 16}px` }}
		>
			<div className="pl-3 py-2">
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<span className="font-medium text-foreground">用户 {reply.authorId.slice(0, 8)}</span>
					<span>·</span>
					<time>{formatDate(reply.createdAt)}</time>
					{isLoggedIn() && (
						<button
							type="button"
							onClick={() => setShowReplyForm(!showReplyForm)}
							className="ml-auto inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
						>
							<Reply className="h-3 w-3" />
							回复
						</button>
					)}
				</div>
				<div className="prose prose-sm mt-1 max-w-none">
					<p className="whitespace-pre-wrap text-sm">{reply.content}</p>
				</div>

				{showReplyForm && (
					<div className="mt-2 space-y-2">
						{error && <p className="text-red-500 text-xs">{error}</p>}
						<div className="flex gap-2">
							<textarea
								value={replyContent}
								onChange={(e) => setReplyContent(e.target.value)}
								placeholder="写下你的回复..."
								rows={2}
								className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
							/>
							<button
								type="button"
								onClick={handleSubmitReply}
								disabled={submitting || !replyContent.trim()}
								className={cn(
									'self-end rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-sm transition-colors hover:bg-primary/90',
									(submitting || !replyContent.trim()) && 'cursor-not-allowed opacity-50',
								)}
							>
								{submitting ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Send className="h-4 w-4" />
								)}
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}

function TopicItem({
	slug,
	topic,
	onUpdated,
}: {
	slug: string
	topic: WikiDiscussion
	onUpdated: () => void
}) {
	const [expanded, setExpanded] = useState(false)
	const [replies, setReplies] = useState<WikiDiscussionReply[]>([])
	const [loadingReplies, setLoadingReplies] = useState(false)
	const [replyContent, setReplyContent] = useState('')
	const [submitting, setSubmitting] = useState(false)
	const [resolving, setResolving] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const loadReplies = useCallback(async () => {
		setLoadingReplies(true)
		const res = await wikiApi.getReplies(slug, topic.id)
		if (res.success && res.data) {
			setReplies(res.data)
		}
		setLoadingReplies(false)
	}, [slug, topic.id])

	useEffect(() => {
		if (expanded) {
			loadReplies()
		}
	}, [expanded, loadReplies])

	const toggleExpand = () => {
		setExpanded(!expanded)
	}

	const handleSubmitReply = async () => {
		if (!replyContent.trim()) return
		setSubmitting(true)
		setError(null)

		const res = await wikiApi.createReply(slug, topic.id, {
			content: replyContent.trim(),
		})

		if (res.success) {
			setReplyContent('')
			await loadReplies()
			onUpdated()
		} else {
			setError(res.message || '回复失败')
		}
		setSubmitting(false)
	}

	const handleResolve = async () => {
		setResolving(true)
		const res = await wikiApi.markResolved(slug, topic.id)
		if (res.success) {
			onUpdated()
		}
		setResolving(false)
	}

	// Build a flat render list with nesting info
	const renderReplies = () => {
		// Group replies by parentReplyId
		const childMap = new Map<string | null, WikiDiscussionReply[]>()
		for (const r of replies) {
			const parent = r.parentReplyId || null
			if (!childMap.has(parent)) childMap.set(parent, [])
			childMap.get(parent)!.push(r)
		}

		const renderList = (parentId: string | null, depth: number) => {
			const children = childMap.get(parentId) || []
			return children.map((r) => (
				<div key={r.id}>
					<ReplyItem
						slug={slug}
						topicId={topic.id}
						reply={r}
						depth={depth}
						onReplyPosted={loadReplies}
					/>
					{renderList(r.id, depth + 1)}
				</div>
			))
		}

		return renderList(null, 0)
	}

	return (
		<div className="border border-border rounded-md overflow-hidden">
			{/* Topic header */}
			<button
				type="button"
				onClick={toggleExpand}
				className={cn(
					'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
					topic.resolved && 'bg-green-50/50',
				)}
			>
				{expanded ? (
					<ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
				) : (
					<ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
				)}
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<span className="font-medium text-sm truncate">{topic.title}</span>
						{topic.resolved && (
							<span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-green-700 text-xs">
								<CheckCircle2 className="h-3 w-3" />
								已解决
							</span>
						)}
					</div>
					<div className="mt-0.5 flex items-center gap-2 text-muted-foreground text-xs">
						<span>用户 {topic.authorId.slice(0, 8)}</span>
						<span>·</span>
						<time>{formatDate(topic.createdAt)}</time>
						<span>·</span>
						<span className="inline-flex items-center gap-1">
							<MessageSquare className="h-3 w-3" />
							{topic.replyCount ?? 0} 回复
						</span>
					</div>
				</div>
			</button>

			{/* Expanded content */}
			{expanded && (
				<div className="border-t border-border">
					{loadingReplies ? (
						<div className="flex items-center justify-center gap-2 py-6 text-muted-foreground text-sm">
							<Loader2 className="h-4 w-4 animate-spin" />
							加载回复...
						</div>
					) : (
						<div className="divide-y divide-border/50">
							{replies.length === 0 ? (
								<p className="py-4 text-center text-muted-foreground text-sm">暂无回复</p>
							) : (
								<div className="px-4 py-2">{renderReplies()}</div>
							)}
						</div>
					)}

					{/* Reply form */}
					{isLoggedIn() && (
						<div className="border-t border-border bg-muted/30 px-4 py-3">
							{error && <p className="mb-2 text-red-500 text-xs">{error}</p>}
							<div className="flex gap-2">
								<textarea
									value={replyContent}
									onChange={(e) => setReplyContent(e.target.value)}
									placeholder="写下你的回复..."
									rows={3}
									className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
								/>
								<div className="flex flex-col gap-2">
									<button
										type="button"
										onClick={handleSubmitReply}
										disabled={submitting || !replyContent.trim()}
										className={cn(
											'inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-primary-foreground text-sm transition-colors hover:bg-primary/90',
											(submitting || !replyContent.trim()) && 'cursor-not-allowed opacity-50',
										)}
									>
										{submitting ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<Send className="h-4 w-4" />
										)}
										发送
									</button>
									{!topic.resolved && (
										<button
											type="button"
											onClick={handleResolve}
											disabled={resolving}
											className="inline-flex items-center gap-1 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-green-700 text-sm transition-colors hover:bg-green-100"
										>
											{resolving ? (
												<Loader2 className="h-4 w-4 animate-spin" />
											) : (
												<CheckCircle2 className="h-4 w-4" />
											)}
											标记已解决
										</button>
									)}
								</div>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	)
}

export default function WikiTalkPage({ slug }: WikiTalkPageProps) {
	const [topics, setTopics] = useState<WikiDiscussion[]>([])
	const [total, setTotal] = useState(0)
	const [offset, setOffset] = useState(0)
	const [loading, setLoading] = useState(true)
	const [showNewTopic, setShowNewTopic] = useState(false)
	const [newTopicTitle, setNewTopicTitle] = useState('')
	const [creating, setCreating] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const loadTopics = useCallback(async () => {
		setLoading(true)
		const res = await wikiApi.getTopics(slug, PAGE_SIZE, offset)
		if (res.success && res.data) {
			setTopics(res.data.items)
			setTotal(res.data.total)
		}
		setLoading(false)
	}, [slug, offset])

	useEffect(() => {
		loadTopics()
	}, [loadTopics])

	const handleCreateTopic = async () => {
		if (!newTopicTitle.trim()) return
		setCreating(true)
		setError(null)

		const res = await wikiApi.createTopic(slug, { title: newTopicTitle.trim() })

		if (res.success) {
			setNewTopicTitle('')
			setShowNewTopic(false)
			setOffset(0)
			await loadTopics()
		} else {
			setError(res.message || '创建讨论失败')
		}
		setCreating(false)
	}

	return (
		<div className="space-y-4">
			<WikiTabs slug={slug} activeTab="talk" />

			<div className="flex items-center justify-between">
				<h2 className="flex items-center gap-2 font-serif text-xl font-normal text-foreground">
					<MessageSquare className="h-5 w-5" />
					讨论页
				</h2>
				{isLoggedIn() && (
					<button
						type="button"
						onClick={() => setShowNewTopic(!showNewTopic)}
						className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-sm transition-colors hover:bg-primary/90"
					>
						<MessageSquarePlus className="h-4 w-4" />
						新话题
					</button>
				)}
			</div>

			{!isLoggedIn() && (
				<div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700 text-sm">
					<AlertCircle className="h-4 w-4 flex-shrink-0" />
					<span>
						请先
						<a href="/briar-display/login" className="mx-1 font-medium text-amber-800 underline">
							登录
						</a>
						后再参与讨论
					</span>
				</div>
			)}

			{/* New topic form */}
			{showNewTopic && (
				<div className="rounded-md border border-primary/30 bg-primary/5 p-4">
					<h3 className="mb-2 font-medium text-sm">创建新话题</h3>
					{error && <p className="mb-2 text-red-500 text-xs">{error}</p>}
					<div className="flex gap-2">
						<input
							type="text"
							value={newTopicTitle}
							onChange={(e) => setNewTopicTitle(e.target.value)}
							placeholder="输入话题标题..."
							onKeyDown={(e) => {
								if (e.key === 'Enter' && !e.shiftKey) {
									e.preventDefault()
									handleCreateTopic()
								}
							}}
							className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
						/>
						<button
							type="button"
							onClick={handleCreateTopic}
							disabled={creating || !newTopicTitle.trim()}
							className={cn(
								'inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm transition-colors hover:bg-primary/90',
								(creating || !newTopicTitle.trim()) && 'cursor-not-allowed opacity-50',
							)}
						>
							{creating ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Send className="h-4 w-4" />
							)}
							发布
						</button>
						<button
							type="button"
							onClick={() => {
								setShowNewTopic(false)
								setNewTopicTitle('')
								setError(null)
							}}
							className="rounded-md px-3 py-2 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
						>
							取消
						</button>
					</div>
				</div>
			)}

			{/* Topics list */}
			{loading ? (
				<div className="space-y-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
					))}
				</div>
			) : topics.length === 0 ? (
				<div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
					<MessageSquare className="h-10 w-10 opacity-30" />
					<p className="text-sm">暂无讨论话题</p>
					{isLoggedIn() && (
						<button
							type="button"
							onClick={() => setShowNewTopic(true)}
							className="text-primary text-sm underline hover:text-primary/80"
						>
							创建第一个话题
						</button>
					)}
				</div>
			) : (
				<div className="space-y-3">
					{topics.map((topic) => (
						<TopicItem key={topic.id} slug={slug} topic={topic} onUpdated={loadTopics} />
					))}
				</div>
			)}

			<WikiPagination total={total} limit={PAGE_SIZE} offset={offset} onPageChange={setOffset} />
		</div>
	)
}
