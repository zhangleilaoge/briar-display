import {
	BrowserAudioRecorder,
	KimiSummarizer,
	type Meeting,
	MeetingSession,
	type MeetingStatus,
	PauseDiarizer,
	type Speaker,
	WebSpeechTranscriber,
} from '@briar/meeting-sdk'
import { useEffect, useRef, useState } from 'react'
import { ElectronStorage } from '../lib/ElectronStorage'

export interface UseMeetingSessionOptions {
	meetingId?: string
	onMeetingUpdate?: (meeting: Meeting) => void
}

export function useMeetingSession(options: UseMeetingSessionOptions = {}) {
	const [meeting, setMeeting] = useState<Meeting | undefined>()
	const [status, setStatus] = useState<MeetingStatus>('idle')
	const [speakers, setSpeakers] = useState<Speaker[]>([])
	const [error, setError] = useState<string | null>(null)
	const sessionRef = useRef<MeetingSession | null>(null)

	useEffect(() => {
		let cancelled = false

		const init = async () => {
			let initialMeeting: Meeting | undefined
			if (options.meetingId) {
				const loaded = await window.electron?.loadMeeting(options.meetingId)
				if (loaded) {
					initialMeeting = loaded as Meeting
				}
			}

			if (cancelled) return

			const storage = new ElectronStorage()
			const recorder = new BrowserAudioRecorder()
			const transcriber = new WebSpeechTranscriber({ lang: 'zh-CN' })
			const diarizer = new PauseDiarizer({ pauseThresholdMs: 1200 })

			const assetConfig = (await window.electron?.getKimiConfig()) ?? {
				apiKey: '',
				model: 'moonshot-v1-8k',
			}
			const apiKey = localStorage.getItem('kimi-api-key') ?? assetConfig.apiKey ?? ''
			const model = localStorage.getItem('kimi-model') ?? assetConfig.model ?? 'moonshot-v1-8k'
			const summarizer = apiKey
				? new KimiSummarizer({ apiKey, model, language: 'zh-CN' })
				: undefined

			const session = new MeetingSession(recorder, transcriber, {
				meeting: initialMeeting,
				diarizer,
				summarizer,
				storage,
				autoSummarizeIntervalMs: 2 * 60 * 1000,
			})

			session.on('statusChange', setStatus)
			session.on('meetingUpdate', (updated) => {
				setMeeting({ ...updated })
				setSpeakers(session.getSpeakers())
				options.onMeetingUpdate?.(updated)
			})
			session.on('error', (err) => setError(err.message))

			sessionRef.current = session
			setMeeting({ ...session.getMeeting() })
			setSpeakers(session.getSpeakers())
		}

		init()

		return () => {
			cancelled = true
			sessionRef.current?.stop().catch(() => {})
		}
	}, [options.meetingId])

	const start = async (title?: string) => {
		setError(null)
		try {
			await sessionRef.current?.start(title)
		} catch (err) {
			setError((err as Error).message)
		}
	}

	const stop = async () => {
		try {
			await sessionRef.current?.stop()
		} catch (err) {
			setError((err as Error).message)
		}
	}

	const updateTitle = (title: string) => {
		sessionRef.current?.updateTitle(title)
	}

	const updateSpeakerName = (speakerId: string, name: string) => {
		sessionRef.current?.updateSpeakerName(speakerId, name)
	}

	const updatePdfContext = (context: string) => {
		sessionRef.current?.updatePdfContext(context)
	}

	return {
		meeting,
		status,
		speakers,
		error,
		start,
		stop,
		updateTitle,
		updateSpeakerName,
		updatePdfContext,
	}
}
