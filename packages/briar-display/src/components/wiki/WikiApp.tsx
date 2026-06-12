'use client'

import NotFound from '@/components/wiki/common/NotFound'
import RouteLoader from '@/components/wiki/common/RouteLoader'
import WikiLayout from '@/components/wiki/layout/WikiLayout'
import { PermissionProvider } from '@/contexts/PermissionContext'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import WikiAllPages from './pages/WikiAllPages'
import WikiArticlePage from './pages/WikiArticlePage'
import WikiCategoryIndex from './pages/WikiCategoryIndex'
import WikiCategoryPage from './pages/WikiCategoryPage'
import WikiEditPage from './pages/WikiEditPage'
import WikiHistoryPage from './pages/WikiHistoryPage'
import WikiHomePage from './pages/WikiHomePage'

import WikiOrphanedPages from './pages/WikiOrphanedPages'
import WikiRecentChanges from './pages/WikiRecentChanges'
import WikiSearchResults from './pages/WikiSearchResults'
import WikiStarsList from './pages/WikiStarsList'
import WikiStatistics from './pages/WikiStatistics'

const decodeURIComponentSafe = (str: string): string => {
	try {
		return decodeURIComponent(str)
	} catch {
		return str
	}
}

import WikiTagPage from './pages/WikiTagPage'
import WikiTagsIndex from './pages/WikiTagsIndex'
import WikiTalkPage from './pages/WikiTalkPage'
import WikiTemplatePage from './pages/WikiTemplatePage'
import WikiTemplatesList from './pages/WikiTemplatesList'
import WikiUserContributions from './pages/WikiUserContributions'
import WikiWantedPages from './pages/WikiWantedPages'
import WikiWatchlist from './pages/WikiWatchlist'

const WIKI_BASE = '/briar-display/wiki'

interface RouteMatch {
	page: ReactNode
	title: string
	showSidebar?: boolean
}

function matchRoute(pathname: string): RouteMatch | null {
	const path = pathname.replace(/\/+$/, '') || WIKI_BASE
	const relative = path.replace(WIKI_BASE, '') || '/'

	// /wiki/ or /wiki → Home
	if (relative === '/' || relative === '') {
		return { page: <WikiHomePage />, title: '首页 - Briar Wiki' }
	}

	// /wiki/new → New article
	if (relative === '/new') {
		return {
			page: <WikiEditPage slug="new" />,
			title: '新建文章 - Briar Wiki',
		}
	}

	// /wiki/search?q=xxx → Search
	if (relative === '/search') {
		return { page: <WikiSearchResults />, title: '搜索 - Briar Wiki' }
	}

	// /wiki/category → Category index
	if (relative === '/category') {
		return { page: <WikiCategoryIndex />, title: '分类 - Briar Wiki' }
	}

	// /wiki/category/:slug → Category detail
	const categoryMatch = relative.match(/^\/category\/(.+)$/)
	if (categoryMatch) {
		return {
			page: <WikiCategoryPage slug={decodeURIComponentSafe(categoryMatch[1])} />,
			title: '分类 - Briar Wiki',
		}
	}

	// /wiki/tag/:slug → Tag detail
	const tagMatch = relative.match(/^\/tag\/(.+)$/)
	if (tagMatch) {
		return {
			page: <WikiTagPage slug={decodeURIComponentSafe(tagMatch[1])} />,
			title: '标签 - Briar Wiki',
		}
	}

	// /wiki/template/:slug → Template detail
	const templateMatch = relative.match(/^\/template\/(.+)$/)
	if (templateMatch) {
		return {
			page: <WikiTemplatePage slug={decodeURIComponentSafe(templateMatch[1])} />,
			title: '模板 - Briar Wiki',
		}
	}

	// Special pages
	if (relative === '/special/recent-changes') {
		return { page: <WikiRecentChanges />, title: '最近更改 - Briar Wiki' }
	}
	if (relative === '/special/statistics') {
		return { page: <WikiStatistics />, title: '统计 - Briar Wiki' }
	}
	if (relative === '/special/all-pages') {
		return { page: <WikiAllPages />, title: '所有页面 - Briar Wiki' }
	}
	if (relative === '/special/orphaned-pages') {
		return { page: <WikiOrphanedPages />, title: '孤立页面 - Briar Wiki' }
	}
	if (relative === '/special/wanted-pages') {
		return { page: <WikiWantedPages />, title: '期望页面 - Briar Wiki' }
	}
	if (relative === '/special/templates') {
		return { page: <WikiTemplatesList />, title: '模板 - Briar Wiki' }
	}
	if (relative === '/special/watchlist') {
		return { page: <WikiWatchlist />, title: '关注列表 - Briar Wiki' }
	}
	if (relative === '/special/stars') {
		return { page: <WikiStarsList />, title: '我的收藏 - Briar Wiki' }
	}
	if (relative === '/special/tags') {
		return { page: <WikiTagsIndex />, title: '标签 - Briar Wiki' }
	}
	// /wiki/special/user-contributions (no userId param in path)
	if (relative === '/special/user-contributions') {
		return { page: <WikiUserContributions />, title: '我的贡献 - Briar Wiki' }
	}

	// /wiki/:slug → Article view
	// /wiki/:slug/edit → Edit
	// /wiki/:slug/history → History
	// /wiki/:slug/talk → Talk
	const slugParts = relative.split('/').filter(Boolean)
	if (slugParts.length >= 1) {
		const slug = decodeURIComponentSafe(slugParts[0])
		const action = slugParts[1]

		if (action === 'edit') {
			return {
				page: <WikiEditPage slug={slug} />,
				title: `编辑: ${slug} - Briar Wiki`,
			}
		}
		if (action === 'history') {
			return {
				page: <WikiHistoryPage slug={slug} />,
				title: `历史: ${slug} - Briar Wiki`,
			}
		}
		if (action === 'talk') {
			return {
				page: <WikiTalkPage slug={slug} />,
				title: `讨论: ${slug} - Briar Wiki`,
			}
		}

		// Default: article view
		return {
			page: <WikiArticlePage slug={slug} />,
			title: `${slug} - Briar Wiki`,
		}
	}

	// No match
	return null
}

// ---- Navigation hook (exported for child components) ----

let _setCurrentPath: ((path: string) => void) | null = null

export function useWikiNav() {
	const navigate = useCallback((href: string) => {
		if (href === window.location.pathname) return
		window.history.pushState({}, '', href)
		window.scrollTo(0, 0)
		_setCurrentPath?.(href)
	}, [])

	return { navigate }
}

// ---- Main component ----

export default function WikiApp() {
	// Use consistent initial state for SSR/CSR hydration
	const [currentPath, setCurrentPath] = useState(WIKI_BASE)

	// Sync with actual URL after hydration
	useEffect(() => {
		if (window.location.pathname !== WIKI_BASE) {
			setCurrentPath(window.location.pathname)
		}
	}, [])
	const [loading, setLoading] = useState(false)
	const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	// Register the setter so useWikiNav can trigger path changes
	_setCurrentPath = setCurrentPath

	// Simulate loading bar on route change
	const triggerLoading = useCallback(() => {
		setLoading(true)
		if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current)
		loadingTimerRef.current = setTimeout(() => setLoading(false), 300)
	}, [])

	useEffect(() => {
		const handlePopState = () => {
			triggerLoading()
			setCurrentPath(window.location.pathname)
		}

		// Intercept wiki link clicks for SPA navigation
		const handleClick = (e: MouseEvent) => {
			// Don't intercept if modifier key is held
			if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

			const target = (e.target as HTMLElement).closest('a')
			if (!target) return

			const href = target.getAttribute('href')
			if (!href) return

			// Only intercept wiki links
			if (!href.startsWith(WIKI_BASE) && !href.startsWith('/briar-display/wiki')) return

			// Don't intercept same-page anchor links
			if (href.startsWith('#')) return
			if (href === currentPath) return

			e.preventDefault()
			triggerLoading()
			window.history.pushState({}, '', href)
			setCurrentPath(href)
			window.scrollTo(0, 0)
		}

		window.addEventListener('popstate', handlePopState)
		document.addEventListener('click', handleClick)

		return () => {
			window.removeEventListener('popstate', handlePopState)
			document.removeEventListener('click', handleClick)
		}
	}, [currentPath, triggerLoading])

	// Update document title in useEffect (not render)
	useEffect(() => {
		const route = matchRoute(currentPath)
		if (route) {
			document.title = route.title
		} else {
			document.title = '页面不存在 - Briar Wiki'
		}
	}, [currentPath])

	const route = matchRoute(currentPath)

	// 404
	if (!route) {
		return (
			<WikiLayout showSidebar={false}>
				<RouteLoader loading={loading} />
				<NotFound />
			</WikiLayout>
		)
	}

	return (
		<PermissionProvider>
			<WikiLayout showSidebar={route.showSidebar !== false}>
				<RouteLoader loading={loading} />
				{route.page}
			</WikiLayout>
		</PermissionProvider>
	)
}
