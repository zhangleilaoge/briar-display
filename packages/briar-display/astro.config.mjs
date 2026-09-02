import { fileURLToPath } from 'url'
import react from '@astrojs/react'
import tailwind from '@astrojs/tailwind'
import vue from '@astrojs/vue'
import { loadEnv } from '@briar/shared/env'
// @ts-check
import { defineConfig } from 'astro/config'

loadEnv(import.meta.url)

const isBuildDev = process.env.BUILD_DEV === 'true'
const isDev = process.argv.includes('dev')
const cdnBase = process.env.BRIAR_TX_BUCKET_DOMAIN?.replace(/\/+$/, '')
const cdnPrefix = 'static'
const assetsPrefix = !isDev && !isBuildDev && cdnBase ? `${cdnBase}/${cdnPrefix}` : undefined

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
								// 避免 HMR 时重复添加
								const hasDataFile = path.node.attributes.some(
									(a) => a.type === 'JSXAttribute' && a.name?.name === 'data-file',
								)
								if (hasDataFile) return
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
			alias: [
				{ find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
				// 直接指向 shared 源码（工作区内部包，非外部依赖），改动即生效、无需先 build dist；
				// 正则精确匹配，不影响 astro.config 在 Node 侧使用的 @briar/shared/env（仍走 dist）
				{
					find: /^@briar\/shared$/,
					replacement: fileURLToPath(new URL('../briar-shared/src/index.ts', import.meta.url)),
				},
			],
		},
		server: {
			proxy: {
				'/api': {
					target: 'http://localhost:3888',
					changeOrigin: true,
				},
			},
		},
		build: {
			rollupOptions: {
				output: {
					manualChunks(id) {
						if (id.includes('node_modules')) {
							if (id.includes('node_modules/react-dom')) return 'react-dom-vendor'
							if (id.includes('node_modules/react/')) return 'react-vendor'
							if (id.includes('node_modules/react-markdown')) return 'markdown-vendor'
							// BlockNote（文件模块 MarkdownPreview 只读预览，体积大，单独分包）
							if (id.includes('prosemirror')) return 'prosemirror-vendor'
							if (id.includes('@blocknote') || id.includes('@mantine')) return 'blocknote-vendor'
						}
					},
				},
			},
		},
	},
})
