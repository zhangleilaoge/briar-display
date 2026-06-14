import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
	plugins: [
		react(),
		electron([
			{
				entry: 'electron/main.ts',
				onstart: ({ startup }) => startup(),
			},
			{
				entry: 'electron/preload.ts',
				onstart: ({ reload }) => reload(),
				vite: {
					build: {
						lib: {
							entry: path.resolve('electron/preload.ts'),
							formats: ['cjs'],
							fileName: () => 'preload.js',
						},
					},
				},
			},
		]),
		renderer(),
	],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, 'src'),
		},
	},
	build: {
		outDir: 'dist',
	},
})
