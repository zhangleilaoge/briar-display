import { Hono } from 'hono'
import { categoryController } from '../controllers/wiki/categoryController'
import { changeRequestController } from '../controllers/wiki/changeRequestController'
import { discussionController } from '../controllers/wiki/discussionController'
import { inlineCommentController } from '../controllers/wiki/inlineCommentController'
import { pageController } from '../controllers/wiki/pageController'
import { revisionController } from '../controllers/wiki/revisionController'
import { specialController } from '../controllers/wiki/specialController'
import { starController } from '../controllers/wiki/starController'
import { tagController } from '../controllers/wiki/tagController'
import { templateController } from '../controllers/wiki/templateController'
import { watchlistController } from '../controllers/wiki/watchlistController'
import { wikiWriteGuard } from '../middleware/wikiWriteGuard'

const wikiRoutes = new Hono()

// 🔒 安全网：所有写操作自动走权限映射表（见 config/wikiPermissions.ts）
// 新增写路由时，必须在映射表中声明权限，否则会被拦截
wikiRoutes.use('/*', wikiWriteGuard)

// ==================== Pages ====================
wikiRoutes.get('/pages', (c) => pageController.list(c))
wikiRoutes.get('/pages/search', (c) => pageController.search(c))

wikiRoutes.get('/pages/:slug/revisions', (c) => revisionController.list(c))
wikiRoutes.get('/pages/:slug/revisions/:revId', (c) => revisionController.getById(c))
wikiRoutes.get('/pages/:slug/diff', (c) => revisionController.getDiff(c))
wikiRoutes.get('/pages/:slug/discussions', (c) => discussionController.listTopics(c))
wikiRoutes.get('/pages/:slug/discussions/:topicId', (c) => discussionController.getTopic(c))
wikiRoutes.get('/pages/:slug/discussions/:topicId/replies', (c) =>
	discussionController.getReplies(c),
)
wikiRoutes.get('/pages/:slug/redirects', (c) => pageController.getRedirects(c))
wikiRoutes.get('/pages/:slug/backlinks', (c) => pageController.getBacklinks(c))
wikiRoutes.get('/pages/:slug/subpages', (c) => pageController.getSubpages(c))
wikiRoutes.get('/pages/:slug/comments', (c) => inlineCommentController.list(c))
wikiRoutes.get('/pages/:slug/comments/:anchor', (c) => inlineCommentController.listByAnchor(c))
wikiRoutes.get('/pages/:slug/change-requests', (c) => changeRequestController.listByPage(c))

wikiRoutes.get('/pages/:namespace/:slug', (c) => pageController.getBySlug(c))
wikiRoutes.get('/pages/:namespace/:slug/details', (c) => pageController.getDetails(c))

wikiRoutes.post('/pages', (c) => pageController.create(c))
wikiRoutes.put('/pages/:slug', (c) => pageController.update(c))
wikiRoutes.delete('/pages/:slug', (c) => pageController.delete(c))

wikiRoutes.post('/pages/:slug/revisions/:revId/revert', (c) => revisionController.revert(c))

wikiRoutes.post('/pages/:slug/discussions', (c) => discussionController.createTopic(c))
wikiRoutes.post('/pages/:slug/discussions/:topicId/replies', (c) =>
	discussionController.createReply(c),
)
wikiRoutes.put('/pages/:slug/discussions/:topicId/resolve', (c) =>
	discussionController.markResolved(c),
)

wikiRoutes.post('/pages/:slug/comments', (c) => inlineCommentController.create(c))
wikiRoutes.put('/pages/:slug/comments/:id', (c) => inlineCommentController.update(c))
wikiRoutes.delete('/pages/:slug/comments/:id', (c) => inlineCommentController.delete(c))

wikiRoutes.post('/pages/:slug/change-requests', (c) => changeRequestController.create(c))

// ==================== Categories ====================
wikiRoutes.get('/categories', (c) => categoryController.list(c))
wikiRoutes.get('/categories/tree', (c) => categoryController.getTree(c))
wikiRoutes.get('/categories/:slug', (c) => categoryController.getBySlug(c))

wikiRoutes.post('/categories', (c) => categoryController.create(c))
wikiRoutes.put('/categories/:slug', (c) => categoryController.update(c))
wikiRoutes.delete('/categories/:slug', (c) => categoryController.delete(c))
wikiRoutes.post('/categories/:slug/pages', (c) => categoryController.addPage(c))
wikiRoutes.delete('/categories/:slug/pages/:pageId', (c) => categoryController.removePage(c))

// ==================== Tags ====================
wikiRoutes.get('/tags', (c) => tagController.list(c))
wikiRoutes.get('/tags/:slug', (c) => tagController.getBySlug(c))
wikiRoutes.get('/tags/:slug/pages', (c) => tagController.getPages(c))

wikiRoutes.post('/tags', (c) => tagController.create(c))
wikiRoutes.delete('/tags/:id', (c) => tagController.delete(c))

// ==================== Stars ====================
wikiRoutes.get('/stars', (c) => starController.list(c))
wikiRoutes.post('/stars/:slug', (c) => starController.add(c))
wikiRoutes.delete('/stars/:slug', (c) => starController.remove(c))
wikiRoutes.get('/stars/:slug/status', (c) => starController.isStarred(c))

// ==================== Templates ====================
wikiRoutes.get('/templates', (c) => templateController.list(c))
wikiRoutes.get('/templates/:slug', (c) => templateController.getBySlug(c))

wikiRoutes.post('/templates', (c) => templateController.create(c))
wikiRoutes.put('/templates/:slug', (c) => templateController.update(c))
wikiRoutes.delete('/templates/:slug', (c) => templateController.delete(c))

// ==================== Watchlist ====================
wikiRoutes.get('/watchlist', (c) => watchlistController.list(c))
wikiRoutes.post('/watchlist/:slug', (c) => watchlistController.add(c))
wikiRoutes.delete('/watchlist/:slug', (c) => watchlistController.remove(c))
wikiRoutes.get('/watchlist/:slug/status', (c) => watchlistController.isWatching(c))

// ==================== Change Requests (Global) ====================
wikiRoutes.get('/change-requests/my', (c) => changeRequestController.listByRequester(c))
wikiRoutes.put('/change-requests/:id/review', (c) => changeRequestController.review(c))
wikiRoutes.delete('/change-requests/:id', (c) => changeRequestController.delete(c))

// ==================== Special Pages ====================
wikiRoutes.get('/special/recent-changes', (c) => specialController.recentChanges(c))
wikiRoutes.get('/special/statistics', (c) => specialController.statistics(c))
wikiRoutes.get('/special/all-pages', (c) => specialController.allPages(c))
wikiRoutes.get('/special/orphaned-pages', (c) => specialController.orphanedPages(c))
wikiRoutes.get('/special/wanted-pages', (c) => specialController.wantedPages(c))
wikiRoutes.get('/special/user-contributions/:userId', (c) => specialController.userContributions(c))

export default wikiRoutes
