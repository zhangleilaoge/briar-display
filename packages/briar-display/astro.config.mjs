import { fileURLToPath } from 'url'
import react from '@astrojs/react'
import tailwind from '@astrojs/tailwind'
import vue from '@astrojs/vue'
import { loadEnv } from '@briar/shared/env'
// @ts-check
import { defineConfig } from 'astro/config'

loadEnv(import.meta.url)

const isBuildDev = process.env.BUILD_DEV === 'true'
const cdnBase = process.env.BRIAR_TX_BUCKET_DOMAIN?.replace(/\/+$/, '')
const cdnPrefix = 'static'
const assetsPrefix = !isBuildDev && cdnBase ? `${cdnBase}/${cdnPrefix}` : undefined

console.log('CDN Base:', assetsPrefix)

// https://astro.build/config
export default defineConfig({
	integrations: [react(), vue(), tailwind()],
	build: assetsPrefix ? { assetsPrefix } : undefined,
	vite: {
		resolve: {
			alias: {
				'@': fileURLToPath(new URL('./src', import.meta.url)),
			},
		},
	},
})
