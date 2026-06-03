import { specialDal } from '../../dal/wiki/specialDal'

export const specialService = {
	async recentChanges(limit = 50, offset = 0) {
		return specialDal.recentChanges(limit, offset)
	},

	async statistics() {
		return specialDal.statistics()
	},

	async allPages(namespace?: string, limit = 50, offset = 0) {
		return specialDal.allPages(namespace as any, limit, offset)
	},

	async orphanedPages(limit = 50, offset = 0) {
		return specialDal.orphanedPages(limit, offset)
	},

	async wantedPages(limit = 50, offset = 0) {
		return specialDal.wantedPages(limit, offset)
	},

	async userContributions(userId: string, limit = 50, offset = 0) {
		return specialDal.userContributions(userId, limit, offset)
	},
}
