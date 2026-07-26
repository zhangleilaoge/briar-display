export type OutputFormat = 'json' | 'msgpack'

export interface Config {
	CHUNK_SIZE: number
	CHUNK_OVERLAP: number
	IMG_THRESHOLD: number
	TEXT_THRESHOLD: number
	TABLE_THRESHOLD: number
	IMG_MIN_SIZE: number
	IMG_MIN_AREA: number
	IMG_GROUP_THRESHOLD: number
	BATCH_SIZE: number
	MAX_IMG_SHOW: number
	RESUME: boolean
	OUTPUT_FORMAT: OutputFormat
}

export const DEFAULT_CONFIG: Config = {
	CHUNK_SIZE: 300,
	CHUNK_OVERLAP: 30,
	IMG_THRESHOLD: 0.7,
	TEXT_THRESHOLD: 0.5,
	TABLE_THRESHOLD: 0.6,
	IMG_MIN_SIZE: 32,
	IMG_MIN_AREA: 8000,
	IMG_GROUP_THRESHOLD: 0.8,
	BATCH_SIZE: 32,
	MAX_IMG_SHOW: 500,
	RESUME: false,
	OUTPUT_FORMAT: 'json',
} as const
