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
	integrations: [
		react({
			babel: {
				plugins: [
					() => ({
						visitor: {
							JSXOpeningElement(path, state) {
								const file = (state.filename || '')
									.replace(/.*[/\\]src[/\\]/, 'src/')
									.replace(/\\/g, '/')
								if (!file.startsWith('src/')) return
								const line = path.node.loc?.start.line || 0
								path.node.attributes.push(
									Object.assign({}, path.node.attributes[0], {
										type: 'JSXAttribute',
										name: { type: 'JSXIdentifier', name: 'data-file' },
										value: { type: 'StringLiteral', value: file },
									}),
									Object.assign({}, path.node.attributes[0], {
										type: 'JSXAttribute',
										name: { type: 'JSXIdentifier', name: 'data-line' },
										value: { type: 'StringLiteral', value: String(line) },
									}),
								)
							},
						},
					}),
				],
			},
		}),
		vue(),
		tailwind(),
	],
	build: assetsPrefix ? { assetsPrefix } : undefined,
	vite: {
		resolve: {
			alias: {
				'@': fileURLToPath(new URL('./src', import.meta.url)),
			},
		},
		plugins: [
			{
				name: 'wiki-spa-fallback',
				configureServer(server) {
					server.middlewares.use((req, res, next) => {
						const url = req.url?.split('?')[0] || ''
						if (
							url.startsWith('/briar-display/wiki/') &&
							url !== '/briar-display/wiki/' &&
							!url.includes('.')
						) {
							req.url = '/briar-display/wiki/'
						}
						next()
					})
				},
			},
		],
	},
})
