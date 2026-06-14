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
