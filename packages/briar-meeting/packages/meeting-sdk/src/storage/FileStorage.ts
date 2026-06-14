import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Meeting, Storage } from '../types.js'

export interface FileStorageOptions {
	baseDir: string
}

export class FileStorage implements Storage {
	private baseDir: string

	constructor(options: FileStorageOptions) {
		this.baseDir = options.baseDir
	}

	private meetingDir(id: string): string {
		return join(this.baseDir, 'meetings', id)
	}

	private metadataPath(id: string): string {
		return join(this.meetingDir(id), 'metadata.json')
	}

	async save(meeting: Meeting): Promise<void> {
		const dir = this.meetingDir(meeting.id)
		await mkdir(dir, { recursive: true })
		await writeFile(this.metadataPath(meeting.id), JSON.stringify(meeting, null, 2))
	}

	async load(id: string): Promise<Meeting | undefined> {
		try {
			const content = await readFile(this.metadataPath(id), 'utf-8')
			return JSON.parse(content) as Meeting
		} catch {
			return undefined
		}
	}

	async list(): Promise<Meeting[]> {
		const meetingsDir = join(this.baseDir, 'meetings')
		try {
			const ids = await readdir(meetingsDir)
			const meetings = await Promise.all(ids.map((id) => this.load(id)))
			return meetings.filter((m): m is Meeting => !!m).sort((a, b) => b.createdAt - a.createdAt)
		} catch {
			return []
		}
	}

	async remove(id: string): Promise<void> {
		await rm(this.meetingDir(id), { recursive: true, force: true })
	}

	async saveAudio(id: string, blob: Blob): Promise<string> {
		const dir = this.meetingDir(id)
		await mkdir(dir, { recursive: true })
		const arrayBuffer = await blob.arrayBuffer()
		const path = join(dir, 'audio.webm')
		await writeFile(path, Buffer.from(arrayBuffer))
		return path
	}

	async loadAudio(id: string): Promise<Buffer | undefined> {
		try {
			return await readFile(join(this.meetingDir(id), 'audio.webm'))
		} catch {
			return undefined
		}
	}
}
