declare module '@breejs/later' {
	interface ScheduleData {
		schedules: number[][]
		exceptions?: number[][]
	}

	interface Later {
		parse: {
			text: (text: string) => ScheduleData
			cron: (cron: string, hasSeconds?: boolean) => ScheduleData
			recur: () => Recur
		}
		schedule: (scheduleData: ScheduleData) => {
			next: (count?: number, startDate?: Date) => Date | Date[]
			prev: (count?: number, startDate?: Date) => Date | Date[]
		}
		date: {
			timezone: () => void
		}
	}

	interface Recur {
		every: (val: number | string) => Recur
		after: (val: number) => Recur
		before: (val: number) => Recur
		first: () => Recur
		last: () => Recur
		on: (val: number | number[]) => Recur
		dayOfMonth: () => Recur
		dayOfWeek: () => Recur
		year: () => Recur
		month: () => Recur
		week: () => Recur
		day: () => Recur
		hour: () => Recur
		minute: () => Recur
		second: () => Recur
		time: () => Recur
		and: () => Recur
		except: () => Recur
		startingOn: (val: number) => Recur
		between: (start: number, end: number) => Recur
		scheduler: (scheduleData: ScheduleData) => {
			next: (count?: number, startDate?: Date) => Date | Date[]
		}
	}

	const later: Later
	export default later
}
