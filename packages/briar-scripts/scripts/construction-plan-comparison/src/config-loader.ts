import fs from 'node:fs'
import path from 'node:path'
import { DEFAULT_CONFIG } from './config.ts'
import type { OutputFormat } from './config.ts'
import type { CliOptions } from './types.ts'

const CONFIG_FILE_NAME = 'bid-compare.config.toml'

export interface AppConfig {
	docs?: string[]
	output: string
	pythonPath: string
	chunkSize: number
	chunkOverlap: number
	imgThreshold: number
	textThreshold: number
	tableThreshold: number
	imgMinSize: number
	imgMinArea: number
	imgGroupThreshold: number
	batchSize: number
	maxImgShow: number
	resume: boolean
	outputFormat: OutputFormat
}

interface RawConfigFile {
	docs?: string[]
	output?: string
	python_path?: string
	resume?: boolean
	output_format?: OutputFormat
	thresholds?: {
		img?: number
		text?: number
		table?: number
	}
	text?: {
		chunk_size?: number
		chunk_overlap?: number
	}
	image?: {
		min_size?: number
		min_area?: number
		group_threshold?: number
		batch_size?: number
		max_show?: number
	}
}

function findConfigFile(cwd: string): string | null {
	let dir = cwd
	while (true) {
		const candidate = path.join(dir, CONFIG_FILE_NAME)
		if (fs.existsSync(candidate)) {
			return candidate
		}
		const parent = path.dirname(dir)
		if (parent === dir) break
		dir = parent
	}
	return null
}

function resolvePaths(raw: RawConfigFile, configDir: string): Partial<AppConfig> {
	const cfg: Partial<AppConfig> = {}

	if (raw.docs) {
		cfg.docs = raw.docs.map((p) => (path.isAbsolute(p) ? p : path.resolve(configDir, p)))
	}
	if (raw.output) {
		cfg.output = path.isAbsolute(raw.output) ? raw.output : path.resolve(configDir, raw.output)
	}
	if (raw.python_path) {
		cfg.pythonPath = path.isAbsolute(raw.python_path)
			? raw.python_path
			: path.resolve(configDir, raw.python_path)
	}

	return cfg
}

export function loadConfig(cwd: string): AppConfig {
	const configPath = findConfigFile(cwd)

	const base: AppConfig = {
		output: path.join(cwd, 'bid_compare_result'),
		pythonPath: '',
		chunkSize: DEFAULT_CONFIG.CHUNK_SIZE,
		chunkOverlap: DEFAULT_CONFIG.CHUNK_OVERLAP,
		imgThreshold: DEFAULT_CONFIG.IMG_THRESHOLD,
		textThreshold: DEFAULT_CONFIG.TEXT_THRESHOLD,
		tableThreshold: DEFAULT_CONFIG.TABLE_THRESHOLD,
		imgMinSize: DEFAULT_CONFIG.IMG_MIN_SIZE,
		imgMinArea: DEFAULT_CONFIG.IMG_MIN_AREA,
		imgGroupThreshold: DEFAULT_CONFIG.IMG_GROUP_THRESHOLD,
		batchSize: DEFAULT_CONFIG.BATCH_SIZE,
		maxImgShow: DEFAULT_CONFIG.MAX_IMG_SHOW,
		resume: DEFAULT_CONFIG.RESUME,
		outputFormat: DEFAULT_CONFIG.OUTPUT_FORMAT,
	}

	if (!configPath) {
		return base
	}

	const configDir = path.dirname(configPath)
	const content = fs.readFileSync(configPath, 'utf-8')
	const raw = (Bun.TOML.parse(content) as RawConfigFile) ?? {}

	const resolved = resolvePaths(raw, configDir)

	return {
		...base,
		...resolved,
		chunkSize: raw.text?.chunk_size ?? base.chunkSize,
		chunkOverlap: raw.text?.chunk_overlap ?? base.chunkOverlap,
		imgThreshold: raw.thresholds?.img ?? base.imgThreshold,
		textThreshold: raw.thresholds?.text ?? base.textThreshold,
		tableThreshold: raw.thresholds?.table ?? base.tableThreshold,
		imgMinSize: raw.image?.min_size ?? base.imgMinSize,
		imgMinArea: raw.image?.min_area ?? base.imgMinArea,
		imgGroupThreshold: raw.image?.group_threshold ?? base.imgGroupThreshold,
		batchSize: raw.image?.batch_size ?? base.batchSize,
		maxImgShow: raw.image?.max_show ?? base.maxImgShow,
		resume: raw.resume ?? base.resume,
		outputFormat: raw.output_format ?? base.outputFormat,
	}
}

export function mergeWithCliArgs(config: AppConfig, cli: Partial<CliOptions>): AppConfig {
	return {
		...config,
		...(cli.output !== undefined ? { output: cli.output } : {}),
		...(cli.docs !== undefined && cli.docs.length > 0 ? { docs: cli.docs } : {}),
		...(cli.imgThreshold !== undefined ? { imgThreshold: cli.imgThreshold } : {}),
		...(cli.textThreshold !== undefined ? { textThreshold: cli.textThreshold } : {}),
		...(cli.tableThreshold !== undefined ? { tableThreshold: cli.tableThreshold } : {}),
		...(cli.chunkSize !== undefined ? { chunkSize: cli.chunkSize } : {}),
		...(cli.imgMinArea !== undefined ? { imgMinArea: cli.imgMinArea } : {}),
		...(cli.imgGroupThreshold !== undefined ? { imgGroupThreshold: cli.imgGroupThreshold } : {}),
		...(cli.resume !== undefined ? { resume: cli.resume } : {}),
		...(cli.outputFormat !== undefined ? { outputFormat: cli.outputFormat } : {}),
	}
}

export function setPythonPathEnv(config: AppConfig): void {
	if (config.pythonPath) {
		process.env.PYTHON_PATH = config.pythonPath
	}
}
