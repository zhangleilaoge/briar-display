import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
	selectPdf: () => Promise<string | null>
	readPdf: (filePath: string) => Promise<{ buffer: string; name: string }>
	saveMeeting: (meeting: unknown) => Promise<void>
	loadMeeting: (id: string) => Promise<unknown | undefined>
	listMeetings: () => Promise<unknown[]>
	removeMeeting: (id: string) => Promise<void>
	saveAudio: (id: string, base64Audio: string) => Promise<string>
	getUserDataPath: () => Promise<string>
	getKimiConfig: () => Promise<{ apiKey: string; model: string }>
}

const api: ElectronAPI = {
	selectPdf: () => ipcRenderer.invoke('select-pdf'),
	readPdf: (filePath) => ipcRenderer.invoke('read-pdf', filePath),
	saveMeeting: (meeting) => ipcRenderer.invoke('save-meeting', meeting),
	loadMeeting: (id) => ipcRenderer.invoke('load-meeting', id),
	listMeetings: () => ipcRenderer.invoke('list-meetings'),
	removeMeeting: (id) => ipcRenderer.invoke('remove-meeting', id),
	saveAudio: (id, base64Audio) => ipcRenderer.invoke('save-audio', id, base64Audio),
	getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
	getKimiConfig: () => ipcRenderer.invoke('get-kimi-config'),
}

contextBridge.exposeInMainWorld('electron', api)
