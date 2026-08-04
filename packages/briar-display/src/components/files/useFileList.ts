'use client'

import { type FileItem, type FileTypeFilter, getFiles } from '@/api/files'
import { useCallback, useEffect, useRef, useState } from 'react'

const PAGE_SIZE = 24

/** 文件列表数据：分页加载、无限滚动、搜索防抖、类型/文件夹筛选 */
export function useFileList() {
	const [files, setFiles] = useState<FileItem[]>([])
	const [total, setTotal] = useState(0)
	const [hasMore, setHasMore] = useState(false)
	const [loading, setLoading] = useState(true)
	const [loadingMore, setLoadingMore] = useState(false)
	const [search, setSearch] = useState('')
	const [keyword, setKeyword] = useState('')
	const [typeFilter, setTypeFilter] = useState<'' | FileTypeFilter>('')
	const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
	const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
	const sentinelRef = useRef<HTMLDivElement>(null)
	const pageRef = useRef(1)
	const hasMoreRef = useRef(false)
	const loadingMoreRef = useRef(false)

	const fetchPage = useCallback(
		async (
			kw: string,
			folderId: string | null,
			type: '' | FileTypeFilter,
			p: number,
			append: boolean,
		) => {
			if (append) {
				setLoadingMore(true)
				loadingMoreRef.current = true
			} else {
				setLoading(true)
			}
			try {
				const res = await getFiles({
					keyword: kw || undefined,
					folderId,
					type: type || undefined,
					page: p,
					pageSize: PAGE_SIZE,
				})
				if (res.success && res.data) {
					setFiles((prev) => (append ? [...prev, ...res.data!.items] : res.data!.items))
					setTotal(res.data.total)
					const nextHasMore = p * PAGE_SIZE < res.data.total
					setHasMore(nextHasMore)
					hasMoreRef.current = nextHasMore
				}
			} catch {
				/* ignore */
			} finally {
				if (append) {
					setLoadingMore(false)
					loadingMoreRef.current = false
				} else {
					setLoading(false)
				}
			}
		},
		[],
	)

	const refresh = useCallback(() => {
		pageRef.current = 1
		fetchPage(keyword, currentFolderId, typeFilter, 1, false)
	}, [fetchPage, keyword, currentFolderId, typeFilter])

	useEffect(() => {
		pageRef.current = 1
		fetchPage(keyword, currentFolderId, typeFilter, 1, false)
	}, [keyword, currentFolderId, typeFilter, fetchPage])

	const handleSearchChange = (value: string) => {
		setSearch(value)
		if (debounceRef.current) clearTimeout(debounceRef.current)
		debounceRef.current = setTimeout(() => {
			setKeyword(value)
		}, 300)
	}

	const loadMore = useCallback(() => {
		if (loadingMoreRef.current || !hasMoreRef.current) return
		const next = pageRef.current + 1
		pageRef.current = next
		fetchPage(keyword, currentFolderId, typeFilter, next, true)
	}, [fetchPage, keyword, currentFolderId, typeFilter])

	useEffect(() => {
		const el = sentinelRef.current
		if (!el) return
		const io = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) loadMore()
				}
			},
			{ rootMargin: '200px' },
		)
		io.observe(el)
		return () => io.disconnect()
	}, [loadMore])

	return {
		files,
		total,
		hasMore,
		loading,
		loadingMore,
		search,
		keyword,
		typeFilter,
		currentFolderId,
		sentinelRef,
		setTypeFilter,
		setCurrentFolderId,
		handleSearchChange,
		refresh,
	}
}
