import type { Meeting, Storage } from '@briar/meeting-sdk'

export class ElectronStorage implements Storage {
	async save(meeting: Meeting): Promise<void> {
		await window.electron?.saveMeeting(meeting)
	}

	async load(id: string): Promise<Meeting | undefined> {
		const result = await window.electron?.loadMeeting(id)
		return result as Meeting | undefined
	}

	async list(): Promise<Meeting[]> {
		const result = await window.electron?.listMeetings()
		return (result as Meeting[] | undefined) ?? []
	}

	async remove(id: string): Promise<void> {
		await window.electron?.removeMeeting(id)
	}

	async saveAudio(id: string, blob: Blob): Promise<string> {
		const arrayBuffer = await blob.arrayBuffer()
		const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
		const path = await window.electron?.saveAudio(id, base64)
		return path ?? ''
	}
}
