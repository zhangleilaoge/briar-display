'use client'

import {
	type FileItem,
	type FileSortField,
	type FileSortOrder,
	type FileTypeFilter,
	getFiles,
} from '@/api/files'
import { useCallback, useEffect, useRef, useState } from 'react'

export const PAGE_SIZE = 24
const BASE_PATH = '/briar/files'

/** 排序组合值（Select 单值，拆成 field + order 传给后端） */
export type FileSortValue = `${FileSortField}-${FileSortOrder}`

export const DEFAULT_SORT: FileSortValue = 'createdAt-desc'

export function splitSort(value: FileSortValue): { sort: FileSortField; order: FileSortOrder } {
	const idx = value.lastIndexOf('-')
	return {
		sort: value.slice(0, idx) as FileSortField,
		order: value.slice(idx + 1) as FileSortOrder,
	}
}

/** 从 URL 路径解析文件夹 id：/briar/files/<folderId> */
function readFolderFromPath(): string | null {
	if (typeof window === 'undefined') return null
	const match = window.location.pathname.match(/^\/briar\/files\/([^/]+)\/?$/)
	return match ? match[1] : null
}

/** 文件列表数据：传统翻页、搜索防抖、类型/文件夹筛选、文件夹路径与 URL 同步 */
export function useFileList() {
	const [files, setFiles] = useState<FileItem[]>([])
	const [total, setTotal] = useState(0)
	const [loading, setLoading] = useState(true)
	const [search, setSearch] = useState('')
	const [keyword, setKeyword] = useState('')
	const [typeFilter, setTypeFilter] = useState<'' | FileTypeFilter>('')
	const [sortValue, setSortValue] = useState<FileSortValue>(DEFAULT_SORT)
	const [page, setPage] = useState(1)
	const [currentFolderId, setCurrentFolderIdState] = useState<string | null>(() =>
		readFolderFromPath(),
	)
	const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

	/** 切换文件夹并同步到 URL（pushState，支持前进/后退） */
	const setCurrentFolderId = useCallback((folderId: string | null) => {
		setCurrentFolderIdState(folderId)
		window.history.pushState({}, '', folderId ? `${BASE_PATH}/${folderId}` : BASE_PATH)
	}, [])

	// 浏览器前进/后退时同步文件夹
	useEffect(() => {
		const onPopState = () => setCurrentFolderIdState(readFolderFromPath())
		window.addEventListener('popstate', onPopState)
		return () => window.removeEventListener('popstate', onPopState)
	}, [])

	const fetchPage = useCallback(
		async (
			kw: string,
			folderId: string | null,
			type: '' | FileTypeFilter,
			sort: FileSortValue,
			p: number,
		) => {
			setLoading(true)
			try {
				const res = await getFiles({
					keyword: kw || undefined,
					folderId,
					type: type || undefined,
					...splitSort(sort),
					page: p,
					pageSize: PAGE_SIZE,
				})
				if (res.success && res.data) {
					setFiles(res.data.items)
					setTotal(res.data.total)
				}
			} catch {
				/* ignore */
			} finally {
				setLoading(false)
			}
		},
		[],
	)

	const refresh = useCallback(() => {
		fetchPage(keyword, currentFolderId, typeFilter, sortValue, page)
	}, [fetchPage, keyword, currentFolderId, typeFilter, sortValue, page])

	// 筛选条件变化时回到第一页
	useEffect(() => {
		setPage(1)
	}, [keyword, currentFolderId, typeFilter, sortValue])

	useEffect(() => {
		fetchPage(keyword, currentFolderId, typeFilter, sortValue, page)
	}, [keyword, currentFolderId, typeFilter, sortValue, page, fetchPage])

	const handleSearchChange = (value: string) => {
		setSearch(value)
		if (debounceRef.current) clearTimeout(debounceRef.current)
		debounceRef.current = setTimeout(() => {
			setKeyword(value)
		}, 300)
	}

	const handlePageChange = useCallback((p: number) => {
		setPage(p)
		window.scrollTo({ top: 0 })
	}, [])

	return {
		files,
		total,
		loading,
		search,
		keyword,
		typeFilter,
		sortValue,
		page,
		currentFolderId,
		setTypeFilter,
		setSortValue,
		setCurrentFolderId,
		setPage: handlePageChange,
		handleSearchChange,
		refresh,
	}
}
