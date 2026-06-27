export interface Config {
	CHUNK_SIZE: number
	CHUNK_OVERLAP: number
	IMG_THRESHOLD: number
	TEXT_THRESHOLD: number
	IMG_MIN_SIZE: number
	BATCH_SIZE: number
	MAX_IMG_SHOW: number
}

export const DEFAULT_CONFIG: Config = {
	CHUNK_SIZE: 300,
	CHUNK_OVERLAP: 30,
	IMG_THRESHOLD: 0.7,
	TEXT_THRESHOLD: 0.5,
	IMG_MIN_SIZE: 32,
	BATCH_SIZE: 32,
	MAX_IMG_SHOW: 500,
} as const
