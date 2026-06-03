'use client'

import { type ReactNode, useEffect, useState } from 'react'
import WikiLayout from './layout/WikiLayout'
import WikiTabs from './layout/WikiTabs'
import WikiAllPages from './pages/WikiAllPages'
import WikiArticlePage from './pages/WikiArticlePage'
import WikiCategoryIndex from './pages/WikiCategoryIndex'
import WikiCategoryPage from './pages/WikiCategoryPage'
import WikiEditPage from './pages/WikiEditPage'
import WikiHistoryPage from './pages/WikiHistoryPage'
import WikiHomePage from './pages/WikiHomePage'
import WikiNewPage from './pages/WikiNewPage'
import WikiOrphanedPages from './pages/WikiOrphanedPages'
import WikiRecentChanges from './pages/WikiRecentChanges'
import WikiSearchResults from './pages/WikiSearchResults'
import WikiStatistics from './pages/WikiStatistics'
import WikiTalkPage from './pages/WikiTalkPage'
import WikiTemplatePage from './pages/WikiTemplatePage'
import WikiWantedPages from './pages/WikiWantedPages'
import WikiWatchlist from './pages/WikiWatchlist'

const WIKI_BASE = '/briar-display/wiki'

interface RouteMatch {
	page: ReactNode
	title: string
	showSidebar?: boolean
}

function matchRoute(pathname: string): RouteMatch {
	const path = pathname.replace(/\/+$/, '') || WIKI_BASE
	const relative = path.replace(WIKI_BASE, '') || '/'

	// /wiki/ or /wiki → Home
	if (relative === '/' || relative === '') {
		return { page: <WikiHomePage />, title: '首页 - Briar Wiki' }
	}

	// /wiki/new → New article
	if (relative === '/new') {
		return {
			page: <WikiNewPage />,
			title: '新建文章 - Briar Wiki',
			showSidebar: false,
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
			page: <WikiCategoryPage slug={categoryMatch[1]} />,
			title: '分类 - Briar Wiki',
		}
	}

	// /wiki/template/:slug → Template detail
	const templateMatch = relative.match(/^\/template\/(.+)$/)
	if (templateMatch) {
		return {
			page: <WikiTemplatePage slug={templateMatch[1]} />,
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
	if (relative === '/special/watchlist') {
		return { page: <WikiWatchlist />, title: '关注列表 - Briar Wiki' }
	}

	// /wiki/:slug → Article view
	// /wiki/:slug/edit → Edit
	// /wiki/:slug/history → History
	// /wiki/:slug/talk → Talk
	const slugParts = relative.split('/').filter(Boolean)
	if (slugParts.length >= 1) {
		const slug = slugParts[0]
		const action = slugParts[1]

		if (action === 'edit') {
			return {
				page: <WikiEditPage slug={slug} />,
				title: `编辑: ${slug} - Briar Wiki`,
				showSidebar: false,
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

	// Fallback: home
	return { page: <WikiHomePage />, title: 'Briar Wiki' }
}

export default function WikiApp() {
	const [currentPath, setCurrentPath] = useState(
		typeof window !== 'undefined' ? window.location.pathname : WIKI_BASE,
	)

	useEffect(() => {
		const handleNavigation = () => {
			setCurrentPath(window.location.pathname)
		}

		window.addEventListener('popstate', handleNavigation)

		// Intercept wiki link clicks for SPA navigation
		const handleClick = (e: MouseEvent) => {
			const target = (e.target as HTMLElement).closest('a')
			if (!target) return

			const href = target.getAttribute('href')
			if (!href || !href.startsWith(WIKI_BASE)) return
			if (href === currentPath) return

			e.preventDefault()
			window.history.pushState({}, '', href)
			setCurrentPath(href)
			window.scrollTo(0, 0)
		}

		document.addEventListener('click', handleClick)

		return () => {
			window.removeEventListener('popstate', handleNavigation)
			document.removeEventListener('click', handleClick)
		}
	}, [currentPath])

	const route = matchRoute(currentPath)

	// Update document title
	if (typeof document !== 'undefined') {
		document.title = route.title
	}

	return (
		<WikiLayout showSidebar={route.showSidebar !== false} title="">
			{route.page}
		</WikiLayout>
	)
}
