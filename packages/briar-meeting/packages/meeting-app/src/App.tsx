import type { Meeting as MeetingType } from '@briar/meeting-sdk'
import { useEffect, useState } from 'react'
import { Home } from './pages/Home'
import { Meeting } from './pages/Meeting'

export default function App() {
	const [activeMeetingId, setActiveMeetingId] = useState<string | null>(null)
	const [meetings, setMeetings] = useState<MeetingType[]>([])

	const loadMeetings = async () => {
		const list = (await window.electron?.listMeetings()) as MeetingType[] | undefined
		if (list) setMeetings(list)
	}

	useEffect(() => {
		loadMeetings()
	}, [])

	const handleCreate = () => {
		setActiveMeetingId('new')
	}

	const handleOpen = (id: string) => {
		setActiveMeetingId(id)
	}

	const handleBack = async () => {
		setActiveMeetingId(null)
		await loadMeetings()
	}

	if (activeMeetingId === 'new') {
		return <Meeting onBack={handleBack} />
	}

	if (activeMeetingId) {
		return <Meeting meetingId={activeMeetingId} onBack={handleBack} />
	}

	return (
		<Home
			meetings={meetings}
			onCreate={handleCreate}
			onOpen={handleOpen}
			onRefresh={loadMeetings}
		/>
	)
}
