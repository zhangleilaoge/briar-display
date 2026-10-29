'use client'

/**
 * 全站客户端路由：全局侧栏与分区壳常驻，只切换页面内容。
 * URL 用 history 同步，支持刷新、深链与前进后退；路由表外链接保持整页跳转。
 */
import {
	type ComponentType,
	type LazyExoticComponent,
	type ReactNode,
	Suspense,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from 'react'

export interface SectionRoute {
	path: string
	title: string
	component?: LazyExoticComponent<ComponentType>
	/** 分区根路径在客户端恢复上次子页，不产生额外历史记录 */
	redirect?: () => string
	/** 内容区占满宽度（管理后台用） */
	fullWidth?: boolean
}

interface SectionRouterValue {
	/** 当前路径（不含尾部斜杠） */
	path: string
	/** 能被当前路由表接管则 pushState 切换并返回 true，否则返回 false */
	navigate: (href: string) => boolean
	/** 全局外壳已提供常驻侧栏，页面壳不再重复挂载 */
	globalShell?: boolean
}

const SectionRouterContext = createContext<SectionRouterValue | null>(null)

export function useSectionRouter(): SectionRouterValue | null {
	return useContext(SectionRouterContext)
}

/** 跳转：路由表内走客户端路由，否则整页跳转 */
export function useNavigate(): (href: string) => void {
	const router = useSectionRouter()
	return useCallback(
		(href: string) => {
			if (router?.navigate(href)) return
			window.location.href = href
		},
		[router],
	)
}

const normalize = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p)

export function useSectionPath<T extends SectionRoute>(initialPath: string, routes: T[]) {
	const [path, setPath] = useState(() => normalize(initialPath))

	const find = useCallback((p: string) => routes.find((r) => r.path === normalize(p)), [routes])

	const navigate = useCallback(
		(href: string) => {
			let url: URL
			try {
				url = new URL(href, window.location.href)
			} catch {
				return false
			}
			if (url.origin !== window.location.origin || !find(url.pathname)) return false
			const next = normalize(url.pathname)
			if (next !== normalize(window.location.pathname) || url.search !== window.location.search) {
				window.history.pushState({ section: true }, '', `${next}${url.search}${url.hash}`)
			}
			setPath(next)
			return true
		},
		[find],
	)

	// 浏览器前进/后退
	useEffect(() => {
		const onPop = () => {
			if (find(window.location.pathname)) setPath(normalize(window.location.pathname))
			else window.location.reload()
		}
		window.addEventListener('popstate', onPop)
		return () => window.removeEventListener('popstate', onPop)
	}, [find])

	const route = find(path)

	useEffect(() => {
		if (route?.redirect) {
			const next = route.redirect()
			if (find(next)) {
				window.history.replaceState({ section: true }, '', next)
				setPath(normalize(next))
			}
			return
		}
		if (route) document.title = route.title
		window.scrollTo({ top: 0 })
	}, [route, find])

	return { path, route, navigate }
}

/** 拦截普通 <a> 点击（不含新窗口/修饰键/下载） */
function onLinkClick(e: React.MouseEvent, navigate: (href: string) => boolean) {
	if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
		return
	const a = (e.target as HTMLElement).closest?.('a')
	if (!a || !a.href || a.target === '_blank' || a.hasAttribute('download')) return
	if (navigate(a.href)) e.preventDefault()
}

export function SectionRouterProvider({
	path,
	navigate,
	globalShell = false,
	children,
}: SectionRouterValue & { children: ReactNode }) {
	return (
		<SectionRouterContext.Provider value={{ path, navigate, globalShell }}>
			<div className="contents" onClickCapture={(e) => onLinkClick(e, navigate)}>
				{children}
			</div>
		</SectionRouterContext.Provider>
	)
}

/**
 * 内容区：首屏（SSR + 水合）只渲染占位，挂载后再按需懒加载当前子页，避免水合不一致；
 * 切换时以 key 重挂外层容器，复用 rv-page-enter 入场动效（--motion-slow / --ease-paper）。
 */
export function SectionOutlet({ route, fallback }: { route?: SectionRoute; fallback: ReactNode }) {
	const [mounted, setMounted] = useState(false)
	useEffect(() => setMounted(true), [])
	if (!mounted || !route?.component) return <>{fallback}</>
	const Page = route.component
	return (
		<div key={route.path} className="rv-page-enter flex min-h-0 w-full flex-1 flex-col">
			<Suspense fallback={fallback}>
				<Page />
			</Suspense>
		</div>
	)
}
