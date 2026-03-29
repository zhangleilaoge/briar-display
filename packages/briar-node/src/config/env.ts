import { loadEnv as sharedLoadEnv } from '@briar/shared/env'

export const loadEnv = () => {
	sharedLoadEnv(import.meta.url)
}
