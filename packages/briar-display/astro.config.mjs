import { fileURLToPath } from 'url'
import react from '@astrojs/react'
import tailwind from '@astrojs/tailwind'
import vue from '@astrojs/vue'
import { loadEnv } from '@briar/shared/env'
// @ts-check
import { defineConfig } from 'astro/config'
import * as THREE from 'three'

const r3fIntrinsicElements = new Set([
	'primitive',
	'threeAudio',
	'threeSource',
	'threeLine',
	'threePath',
	...Object.entries(THREE)
		.filter(([, value]) => typeof value === 'function')
		.map(([name]) => name.charAt(0).toLowerCase() + name.slice(1)),
])
for (const name of ['audio', 'source', 'line', 'path']) r3fIntrinsicElements.delete(name)

function isR3FElement(path) {
	if (path.node.name.type !== 'JSXIdentifier') return false
	const { name } = path.node.name
	if (r3fIntrinsicElements.has(name)) return true
	const binding = path.scope.getBinding(name)
	const importDeclaration = binding?.path.findParent((parent) => parent.isImportDeclaration())
	return importDeclaration?.node.source.value.startsWith('@react-three/') ?? false
}

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
								// R3F 会把 data-* 解释为三维对象的属性路径，不能注入 DOM 定位元数据。
								if (isR3FElement(path)) return
								// Fragment 只接受 key/children，注入 data-* 会触发 React 警告
								const n = path.node.name
								if (
									(n.type === 'JSXIdentifier' && n.name === 'Fragment') ||
									(n.type === 'JSXMemberExpression' && n.property?.name === 'Fragment')
								)
									return
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
						// Vite 的 preload-helper / CJS 互操作 helper 独立成 chunk，
						// 避免被就近卷进某个 vendor 后让所有用到动态 import 的页面静态依赖它
						if (id.includes('vite/preload-helper') || id.includes('commonjsHelpers'))
							return 'vite-helpers'
						if (id.includes('node_modules')) {
							if (id.includes('node_modules/react-dom')) return 'react-dom-vendor'
							if (id.includes('node_modules/react/')) return 'react-vendor'
							// react-icons 被 FileTypeIcon 和 BlockNote 共用，独立分包避免被卷进大块头
							if (id.includes('node_modules/react-icons')) return 'react-icons'
							if (id.includes('node_modules/react-markdown')) return 'markdown-vendor'
							// 注意：不要为 @blocknote/prosemirror 设 manualChunks ——
							// 函数式 manualChunks 会把共享依赖（react-remove-scroll/clsx 等）就近吸进该 chunk，
							// 导致 shadcn 基础组件都静态依赖它，MarkdownPreview 的懒加载失效。
							// 懒加载边界（React.lazy）本身已能保证 BlockNote 按需加载。
						}
					},
				},
			},
		},
	},
})
