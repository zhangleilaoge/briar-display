import type { AudioRecorder } from '../types.js'

export interface BrowserAudioRecorderOptions {
	mimeType?: string
	timeslice?: number
}

export class BrowserAudioRecorder implements AudioRecorder {
	private stream?: MediaStream
	private mediaRecorder?: MediaRecorder
	private chunks: Blob[] = []
	private dataCallbacks: Array<(blob: Blob) => void> = []
	private options: BrowserAudioRecorderOptions

	constructor(options: BrowserAudioRecorderOptions = {}) {
		this.options = options
	}

	async start(): Promise<MediaStream> {
		this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
		const mimeType = this.options.mimeType ?? 'audio/webm'
		this.mediaRecorder = new MediaRecorder(this.stream, { mimeType })
		this.chunks = []

		this.mediaRecorder.ondataavailable = (event) => {
			if (event.data.size > 0) {
				this.chunks.push(event.data)
				this.dataCallbacks.forEach((cb) => cb(event.data))
			}
		}

		this.mediaRecorder.start(this.options.timeslice ?? 1000)
		return this.stream
	}

	async stop(): Promise<Blob | undefined> {
		return new Promise((resolve) => {
			if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
				this.stopStream()
				resolve(undefined)
				return
			}

			this.mediaRecorder.onstop = () => {
				this.stopStream()
				const blob = new Blob(this.chunks, { type: this.mediaRecorder?.mimeType ?? 'audio/webm' })
				this.chunks = []
				resolve(blob)
			}

			this.mediaRecorder.stop()
		})
	}

	onDataAvailable(callback: (blob: Blob) => void): () => void {
		this.dataCallbacks.push(callback)
		return () => {
			this.dataCallbacks = this.dataCallbacks.filter((cb) => cb !== callback)
		}
	}

	private stopStream() {
		this.stream?.getTracks().forEach((track) => track.stop())
		this.stream = undefined
		this.mediaRecorder = undefined
	}
}
