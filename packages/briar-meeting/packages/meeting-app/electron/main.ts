import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FileStorage } from '@briar/meeting-sdk'
import { config } from 'dotenv'
import { BrowserWindow, app, dialog, ipcMain, shell } from 'electron'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
	? path.join(process.env.APP_ROOT, 'public')
	: RENDERER_DIST

const assetsEnvPath = path.resolve(process.env.APP_ROOT, '../../briar-assets/briar/.env')
config({ path: assetsEnvPath })

let win: BrowserWindow | null = null

const storage = new FileStorage({ baseDir: app.getPath('userData') })

function createWindow() {
	win = new BrowserWindow({
		width: 1280,
		height: 840,
		minWidth: 960,
		minHeight: 640,
		webPreferences: {
			preload: path.join(__dirname, '../dist-electron/preload.js'),
			contextIsolation: true,
			nodeIntegration: false,
		},
		titleBarStyle: 'hiddenInset',
	})

	if (VITE_DEV_SERVER_URL) {
		win.loadURL(VITE_DEV_SERVER_URL)
	} else {
		win.loadFile(path.join(RENDERER_DIST, 'index.html'))
	}

	win.webContents.setWindowOpenHandler(({ url }) => {
		shell.openExternal(url)
		return { action: 'deny' }
	})
}

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit()
		win = null
	}
})

app.on('activate', () => {
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow()
	}
})

app.whenReady().then(createWindow)

ipcMain.handle('select-pdf', async () => {
	const result = await dialog.showOpenDialog({
		properties: ['openFile'],
		filters: [{ name: 'PDF', extensions: ['pdf'] }],
	})
	return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('read-pdf', async (_, filePath: string) => {
	const buffer = await readFile(filePath)
	return { buffer: buffer.toString('base64'), name: path.basename(filePath) }
})

ipcMain.handle('save-meeting', async (_, meeting) => {
	await storage.save(meeting)
})

ipcMain.handle('load-meeting', async (_, id: string) => {
	return storage.load(id)
})

ipcMain.handle('list-meetings', async () => {
	return storage.list()
})

ipcMain.handle('remove-meeting', async (_, id: string) => {
	await storage.remove(id)
})

ipcMain.handle('save-audio', async (_, id: string, base64Audio: string) => {
	const buffer = Buffer.from(base64Audio, 'base64')
	const blob = new Blob([buffer])
	const filePath = await storage.saveAudio(id, blob)
	return filePath
})

ipcMain.handle('get-user-data-path', () => {
	return app.getPath('userData')
})

ipcMain.handle('get-kimi-config', () => {
	return {
		apiKey: process.env.KIMI_API_KEY ?? '',
		model: process.env.KIMI_MODEL ?? 'moonshot-v1-8k',
	}
})
