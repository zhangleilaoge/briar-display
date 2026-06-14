export interface Speaker {
	id: string
	name: string
	color?: string
}

export interface TranscriptSegment {
	id: string
	speakerId: string
	text: string
	startTime: number
	endTime: number
	isInterim: boolean
}

export interface SummaryChunk {
	id: string
	startTime: number
	endTime: number
	topics: string[]
	content: string
	rawSegmentIds: string[]
}

export interface Meeting {
	id: string
	title: string
	createdAt: number
	updatedAt: number
	pdfContext?: string
	segments: TranscriptSegment[]
	summaries: SummaryChunk[]
	audioBlobPath?: string
}

export interface AudioRecorder {
	start(): Promise<MediaStream | undefined>
	stop(): Promise<Blob | undefined>
	onDataAvailable(callback: (blob: Blob) => void): () => void
}

export interface TranscriberEvents {
	interim: (segment: TranscriptSegment) => void
	final: (segment: TranscriptSegment) => void
	error: (error: Error) => void
}

export interface Transcriber {
	start(stream: MediaStream): Promise<void>
	stop(): Promise<void>
	on(event: 'interim', listener: (segment: TranscriptSegment) => void): this
	on(event: 'final', listener: (segment: TranscriptSegment) => void): this
	on(event: 'error', listener: (error: Error) => void): this
}

export interface Diarizer {
	assignSpeaker(segment: Pick<TranscriptSegment, 'startTime' | 'endTime' | 'text'>): string
	updateSpeakerName(speakerId: string, name: string): void
	getSpeakers(): Speaker[]
}

export interface SummarizerOptions {
	apiKey: string
	baseURL?: string
	model?: string
	language?: string
}

export interface Summarizer {
	summarize(segments: TranscriptSegment[], context?: string): Promise<SummaryChunk>
}

export interface DocumentParser {
	parsePdf(buffer: ArrayBuffer | Buffer): Promise<string>
}

export interface Storage {
	save(meeting: Meeting): Promise<void>
	load(id: string): Promise<Meeting | undefined>
	list(): Promise<Meeting[]>
	remove(id: string): Promise<void>
}

export interface MeetingSessionOptions {
	meeting?: Meeting
	diarizer?: Diarizer
	summarizer?: Summarizer
	storage?: Storage
	autoSummarizeIntervalMs?: number
	onMeetingUpdate?: (meeting: Meeting) => void
}

export type MeetingStatus = 'idle' | 'recording' | 'paused' | 'stopped'
