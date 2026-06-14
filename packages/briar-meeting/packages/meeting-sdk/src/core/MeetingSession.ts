import EventEmitter from 'eventemitter3'
import { v4 as uuid } from 'uuid'
import type {
	AudioRecorder,
	Diarizer,
	Meeting,
	MeetingSessionOptions,
	MeetingStatus,
	Storage,
	Summarizer,
	Transcriber,
	TranscriptSegment,
} from '../types.js'

export interface MeetingSessionEvents {
	statusChange: (status: MeetingStatus) => void
	segment: (segment: TranscriptSegment) => void
	meetingUpdate: (meeting: Meeting) => void
	error: (error: Error) => void
}

export class MeetingSession extends EventEmitter<MeetingSessionEvents> {
	private meeting: Meeting
	private status: MeetingStatus = 'idle'
	private recorder: AudioRecorder
	private transcriber: Transcriber
	private diarizer: Diarizer
	private summarizer?: Summarizer
	private storage?: Storage
	private startTime = 0
	private currentInterimId?: string
	private audioChunks: Blob[] = []
	private summarizeTimer?: ReturnType<typeof setInterval>
	private readonly autoSummarizeIntervalMs: number
	private lastSummarizedIndex = 0

	constructor(
		recorder: AudioRecorder,
		transcriber: Transcriber,
		options: MeetingSessionOptions = {},
	) {
		super()
		this.recorder = recorder
		this.transcriber = transcriber
		this.diarizer = options.diarizer ?? {
			assignSpeaker: () => 'speaker-1',
			updateSpeakerName: () => {},
			getSpeakers: () => [{ id: 'speaker-1', name: '说话人 1' }],
		}
		this.summarizer = options.summarizer
		this.storage = options.storage
		this.autoSummarizeIntervalMs = options.autoSummarizeIntervalMs ?? 5 * 60 * 1000
		this.meeting = options.meeting ?? {
			id: uuid(),
			title: `会议 ${new Date().toLocaleString('zh-CN')}`,
			createdAt: Date.now(),
			updatedAt: Date.now(),
			segments: [],
			summaries: [],
		}
		this.setupTranscriber()
		this.setupRecorder()
	}

	private setupTranscriber() {
		this.transcriber.on('interim', (segment) => {
			if (!this.currentInterimId) {
				this.currentInterimId = segment.id
			}
			const speakerId = this.diarizer.assignSpeaker(segment)
			const updated: TranscriptSegment = { ...segment, speakerId }
			this.replaceInterimSegment(updated)
			this.emit('segment', updated)
		})

		this.transcriber.on('final', (segment) => {
			const speakerId = this.diarizer.assignSpeaker(segment)
			const finalized: TranscriptSegment = { ...segment, speakerId, isInterim: false }
			this.removeInterimSegment()
			this.meeting.segments.push(finalized)
			this.meeting.updatedAt = Date.now()
			this.emit('segment', finalized)
			this.notifyUpdate()
			this.persist()
		})

		this.transcriber.on('error', (error) => {
			this.emit('error', error)
		})
	}

	private setupRecorder() {
		this.recorder.onDataAvailable((blob) => {
			this.audioChunks.push(blob)
		})
	}

	private replaceInterimSegment(segment: TranscriptSegment) {
		const idx = this.meeting.segments.findIndex((s) => s.id === segment.id || s.isInterim)
		if (idx >= 0) {
			this.meeting.segments[idx] = segment
		} else {
			this.meeting.segments.push(segment)
		}
		this.meeting.updatedAt = Date.now()
		this.notifyUpdate()
	}

	private removeInterimSegment() {
		this.meeting.segments = this.meeting.segments.filter((s) => !s.isInterim)
		this.currentInterimId = undefined
	}

	private notifyUpdate() {
		this.emit('meetingUpdate', this.meeting)
		this.storage?.save(this.meeting).catch((err) => this.emit('error', err))
	}

	private persist() {
		this.storage?.save(this.meeting).catch((err) => this.emit('error', err))
	}

	async start(title?: string) {
		if (this.status === 'recording') return
		if (title) this.meeting.title = title
		this.status = 'recording'
		this.emit('statusChange', this.status)
		this.startTime = Date.now()
		try {
			const stream = await this.recorder.start()
			if (stream) {
				await this.transcriber.start(stream)
			}
			this.summarizeTimer = setInterval(() => {
				this.triggerSummarize()
			}, this.autoSummarizeIntervalMs)
		} catch (error) {
			this.status = 'idle'
			this.emit('statusChange', this.status)
			throw error
		}
	}

	async stop() {
		if (this.status !== 'recording') return
		this.status = 'stopped'
		this.emit('statusChange', this.status)
		if (this.summarizeTimer) {
			clearInterval(this.summarizeTimer)
			this.summarizeTimer = undefined
		}
		await this.transcriber.stop()
		const blob = await this.recorder.stop()
		this.removeInterimSegment()
		this.meeting.updatedAt = Date.now()
		await this.triggerSummarize()
		this.notifyUpdate()
		if (blob && this.storage && 'saveAudio' in this.storage) {
			try {
				const path = await (
					this.storage as unknown as { saveAudio: (id: string, blob: Blob) => Promise<string> }
				).saveAudio(this.meeting.id, blob)
				this.meeting.audioBlobPath = path
				await this.storage.save(this.meeting)
			} catch (err) {
				this.emit('error', err as Error)
			}
		}
	}

	private async triggerSummarize() {
		if (!this.summarizer) return
		const pending = this.meeting.segments.slice(this.lastSummarizedIndex)
		if (pending.length === 0) return
		try {
			const chunk = await this.summarizer.summarize(pending, this.meeting.pdfContext)
			this.meeting.summaries.push(chunk)
			this.lastSummarizedIndex = this.meeting.segments.length
			this.meeting.updatedAt = Date.now()
			this.notifyUpdate()
		} catch (err) {
			this.emit('error', err as Error)
		}
	}

	getMeeting(): Meeting {
		return this.meeting
	}

	getStatus(): MeetingStatus {
		return this.status
	}

	updateTitle(title: string) {
		this.meeting.title = title
		this.meeting.updatedAt = Date.now()
		this.notifyUpdate()
	}

	updatePdfContext(context: string) {
		this.meeting.pdfContext = context
		this.meeting.updatedAt = Date.now()
		this.notifyUpdate()
	}

	updateSpeakerName(speakerId: string, name: string) {
		this.diarizer.updateSpeakerName(speakerId, name)
		this.meeting.updatedAt = Date.now()
		this.notifyUpdate()
	}

	getSpeakers() {
		return this.diarizer.getSpeakers()
	}
}
