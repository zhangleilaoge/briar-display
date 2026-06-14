import EventEmitter from 'eventemitter3'
import { v4 as uuid } from 'uuid'
import type { Transcriber, TranscriberEvents, TranscriptSegment } from '../types.js'

interface SpeechRecognitionEvent extends Event {
	resultIndex: number
	results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
	error: string
	message: string
}

interface SpeechRecognitionResultList {
	length: number
	item(index: number): SpeechRecognitionResult
	[index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
	isFinal: boolean
	length: number
	item(index: number): SpeechRecognitionAlternative
	[index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
	transcript: string
	confidence: number
}

interface SpeechRecognition extends EventTarget {
	lang: string
	continuous: boolean
	interimResults: boolean
	maxAlternatives: number
	start(): void
	stop(): void
	abort(): void
	onresult: ((event: SpeechRecognitionEvent) => void) | null
	onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
	onend: (() => void) | null
}

interface SpeechRecognitionConstructor {
	new (): SpeechRecognition
}

declare global {
	interface Window {
		SpeechRecognition?: SpeechRecognitionConstructor
		webkitSpeechRecognition?: SpeechRecognitionConstructor
	}
}

export interface WebSpeechTranscriberOptions {
	lang?: string
	maxAlternatives?: number
}

export class WebSpeechTranscriber extends EventEmitter<TranscriberEvents> implements Transcriber {
	private recognition?: SpeechRecognition
	private options: WebSpeechTranscriberOptions
	private sessionStartTime = 0
	private currentSegmentId?: string

	constructor(options: WebSpeechTranscriberOptions = {}) {
		super()
		this.options = options
	}

	async start(): Promise<void> {
		const Constructor = window.SpeechRecognition ?? window.webkitSpeechRecognition
		if (!Constructor) {
			throw new Error('当前环境不支持 Web Speech API')
		}

		this.recognition = new Constructor()
		this.recognition.lang = this.options.lang ?? 'zh-CN'
		this.recognition.continuous = true
		this.recognition.interimResults = true
		this.recognition.maxAlternatives = this.options.maxAlternatives ?? 1
		this.sessionStartTime = Date.now()

		this.recognition.onresult = (event) => {
			const now = Date.now() - this.sessionStartTime
			let finalTranscript = ''
			let interimTranscript = ''

			for (let i = event.resultIndex; i < event.results.length; i++) {
				const transcript = event.results[i][0]?.transcript ?? ''
				if (event.results[i].isFinal) {
					finalTranscript += transcript
				} else {
					interimTranscript += transcript
				}
			}

			if (interimTranscript) {
				if (!this.currentSegmentId) {
					this.currentSegmentId = uuid()
				}
				const segment: TranscriptSegment = {
					id: this.currentSegmentId,
					speakerId: '',
					text: interimTranscript,
					startTime: now,
					endTime: now,
					isInterim: true,
				}
				this.emit('interim', segment)
			}

			if (finalTranscript) {
				const segment: TranscriptSegment = {
					id: this.currentSegmentId ?? uuid(),
					speakerId: '',
					text: finalTranscript,
					startTime: now,
					endTime: now,
					isInterim: false,
				}
				this.currentSegmentId = undefined
				this.emit('final', segment)
			}
		}

		this.recognition.onerror = (event) => {
			if (event.error === 'aborted' || event.error === 'no-speech') return
			this.emit('error', new Error(`语音识别错误: ${event.error}`))
		}

		this.recognition.onend = () => {
			if (this.recognition) {
				try {
					this.recognition.start()
				} catch {
					// ignored
				}
			}
		}

		this.recognition.start()
	}

	async stop(): Promise<void> {
		if (!this.recognition) return
		try {
			this.recognition.onend = null
			this.recognition.stop()
		} finally {
			this.recognition = undefined
			this.currentSegmentId = undefined
		}
	}
}
