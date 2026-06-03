import { Hono } from 'hono'
import { categoryController } from '../controllers/wiki/categoryController'
import { discussionController } from '../controllers/wiki/discussionController'
import { pageController } from '../controllers/wiki/pageController'
import { revisionController } from '../controllers/wiki/revisionController'
import { specialController } from '../controllers/wiki/specialController'
import { templateController } from '../controllers/wiki/templateController'
import { watchlistController } from '../controllers/wiki/watchlistController'
import { authMiddleware } from '../middleware/authMiddleware'

const wikiRoutes = new Hono()

// ==================== Pages ====================
// Public
wikiRoutes.get('/pages', (c) => pageController.list(c))
wikiRoutes.get('/pages/search', (c) => pageController.search(c))
wikiRoutes.get('/pages/:namespace/:slug', (c) => pageController.getBySlug(c))
wikiRoutes.get('/pages/:slug/redirects', (c) => pageController.getRedirects(c))

// Protected
wikiRoutes.post('/pages', authMiddleware, (c) => pageController.create(c))
wikiRoutes.put('/pages/:slug', authMiddleware, (c) => pageController.update(c))
wikiRoutes.delete('/pages/:slug', authMiddleware, (c) => pageController.delete(c))

// ==================== Revisions ====================
// Public
wikiRoutes.get('/pages/:slug/revisions', (c) => revisionController.list(c))
wikiRoutes.get('/pages/:slug/revisions/:revId', (c) => revisionController.getById(c))
wikiRoutes.get('/pages/:slug/diff', (c) => revisionController.getDiff(c))

// Protected
wikiRoutes.post('/pages/:slug/revisions/:revId/revert', authMiddleware, (c) =>
	revisionController.revert(c),
)

// ==================== Categories ====================
// Public
wikiRoutes.get('/categories', (c) => categoryController.list(c))
wikiRoutes.get('/categories/tree', (c) => categoryController.getTree(c))
wikiRoutes.get('/categories/:slug', (c) => categoryController.getBySlug(c))

// Protected
wikiRoutes.post('/categories', authMiddleware, (c) => categoryController.create(c))
wikiRoutes.put('/categories/:slug', authMiddleware, (c) => categoryController.update(c))
wikiRoutes.delete('/categories/:slug', authMiddleware, (c) => categoryController.delete(c))
wikiRoutes.post('/categories/:slug/pages', authMiddleware, (c) => categoryController.addPage(c))
wikiRoutes.delete('/categories/:slug/pages/:pageId', authMiddleware, (c) =>
	categoryController.removePage(c),
)

// ==================== Discussions ====================
// Public
wikiRoutes.get('/pages/:slug/discussions', (c) => discussionController.listTopics(c))
wikiRoutes.get('/pages/:slug/discussions/:topicId', (c) => discussionController.getTopic(c))
wikiRoutes.get('/pages/:slug/discussions/:topicId/replies', (c) =>
	discussionController.getReplies(c),
)

// Protected
wikiRoutes.post('/pages/:slug/discussions', authMiddleware, (c) =>
	discussionController.createTopic(c),
)
wikiRoutes.post('/pages/:slug/discussions/:topicId/replies', authMiddleware, (c) =>
	discussionController.createReply(c),
)
wikiRoutes.put('/pages/:slug/discussions/:topicId/resolve', authMiddleware, (c) =>
	discussionController.markResolved(c),
)

// ==================== Templates ====================
// Public
wikiRoutes.get('/templates', (c) => templateController.list(c))
wikiRoutes.get('/templates/:slug', (c) => templateController.getBySlug(c))

// Protected
wikiRoutes.post('/templates', authMiddleware, (c) => templateController.create(c))
wikiRoutes.put('/templates/:slug', authMiddleware, (c) => templateController.update(c))
wikiRoutes.delete('/templates/:slug', authMiddleware, (c) => templateController.delete(c))

// ==================== Watchlist ====================
// Protected
wikiRoutes.get('/watchlist', authMiddleware, (c) => watchlistController.list(c))
wikiRoutes.post('/watchlist/:slug', authMiddleware, (c) => watchlistController.add(c))
wikiRoutes.delete('/watchlist/:slug', authMiddleware, (c) => watchlistController.remove(c))
wikiRoutes.get('/watchlist/:slug/status', authMiddleware, (c) => watchlistController.isWatching(c))

// ==================== Special Pages ====================
// Public
wikiRoutes.get('/special/recent-changes', (c) => specialController.recentChanges(c))
wikiRoutes.get('/special/statistics', (c) => specialController.statistics(c))
wikiRoutes.get('/special/all-pages', (c) => specialController.allPages(c))
wikiRoutes.get('/special/orphaned-pages', (c) => specialController.orphanedPages(c))
wikiRoutes.get('/special/wanted-pages', (c) => specialController.wantedPages(c))
wikiRoutes.get('/special/user-contributions/:userId', (c) => specialController.userContributions(c))

export default wikiRoutes
