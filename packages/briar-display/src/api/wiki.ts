import { categoryApi } from './wiki/categoryApi'
import { discussionApi } from './wiki/discussionApi'
import { pageApi } from './wiki/pageApi'
import { specialApi } from './wiki/specialApi'
import { starApi } from './wiki/starApi'
import { tagApi } from './wiki/tagApi'
import { templateApi } from './wiki/templateApi'
import { watchlistApi } from './wiki/watchlistApi'

export const wikiApi = {
	...pageApi,
	...categoryApi,
	...tagApi,
	...starApi,
	...discussionApi,
	...templateApi,
	...watchlistApi,
	...specialApi,
}
