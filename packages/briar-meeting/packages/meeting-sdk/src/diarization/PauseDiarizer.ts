import { v4 as uuid } from 'uuid'
import type { Diarizer, Speaker, TranscriptSegment } from '../types.js'

export interface PauseDiarizerOptions {
	pauseThresholdMs?: number
	speakerColors?: string[]
}

export class PauseDiarizer implements Diarizer {
	private speakers: Map<string, Speaker> = new Map()
	private lastSegmentEndTime = 0
	private currentSpeakerId?: string
	private pauseThresholdMs: number
	private colorPalette: string[]
	private colorIndex = 0

	constructor(options: PauseDiarizerOptions = {}) {
		this.pauseThresholdMs = options.pauseThresholdMs ?? 1500
		this.colorPalette = options.speakerColors ?? [
			'#3b82f6',
			'#10b981',
			'#f59e0b',
			'#ef4444',
			'#8b5cf6',
			'#ec4899',
			'#06b6d4',
		]
	}

	assignSpeaker(segment: Pick<TranscriptSegment, 'startTime' | 'endTime' | 'text'>): string {
		const isNewSpeaker =
			!this.currentSpeakerId || segment.startTime - this.lastSegmentEndTime > this.pauseThresholdMs

		if (isNewSpeaker) {
			this.currentSpeakerId = this.createSpeaker()
		}

		this.lastSegmentEndTime = segment.endTime
		return this.currentSpeakerId!
	}

	updateSpeakerName(speakerId: string, name: string) {
		const speaker = this.speakers.get(speakerId)
		if (speaker) {
			speaker.name = name
		}
	}

	getSpeakers(): Speaker[] {
		return Array.from(this.speakers.values())
	}

	private createSpeaker(): string {
		const id = uuid()
		const color = this.colorPalette[this.colorIndex % this.colorPalette.length]
		this.colorIndex++
		const speaker: Speaker = {
			id,
			name: `说话人 ${this.speakers.size + 1}`,
			color,
		}
		this.speakers.set(id, speaker)
		return id
	}
}
