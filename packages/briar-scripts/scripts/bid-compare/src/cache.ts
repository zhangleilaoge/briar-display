import fs from 'node:fs'
import path from 'node:path'
import type { ImageItem, TableChunk, TextChunk } from './types.ts'

export interface FileFingerprint {
	mtime: number
	size: number
}

const TEXT_TABLES_CACHE_VERSION = 2
const IMAGES_CACHE_VERSION = 1

export interface TextTablesCache {
	version: number
	doc: number
	pdfPath: string
	fingerprint: FileFingerprint
	chunks: TextChunk[]
	tables: TableChunk[]
}

export interface ImagesCache {
	version: number
	fingerprint: FileFingerprint
	images: ImageItem[]
}

function getFingerprint(filePath: string): FileFingerprint | null {
	try {
		const stat = fs.statSync(filePath)
		return { mtime: stat.mtimeMs, size: stat.size }
	} catch {
		return null
	}
}

function isSameFingerprint(a: FileFingerprint | undefined, b: FileFingerprint | null): boolean {
	if (!a || !b) return false
	return a.mtime === b.mtime && a.size === b.size
}

export function getCacheDir(outputDir: string): string {
	return path.join(outputDir, 'cache')
}

export function loadTextTablesCache(
	cacheDir: string,
	pdfPath: string,
	docIdx: number,
): { chunks: TextChunk[]; tables: TableChunk[] } | null {
	const filePath = path.join(cacheDir, `doc${docIdx}_text_tables.json`)
	if (!fs.existsSync(filePath)) return null

	try {
		const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as TextTablesCache
		const current = getFingerprint(pdfPath)
		if (
			data.version !== TEXT_TABLES_CACHE_VERSION ||
			data.doc !== docIdx ||
			data.pdfPath !== pdfPath ||
			!isSameFingerprint(data.fingerprint, current)
		) {
			return null
		}
		return { chunks: data.chunks, tables: data.tables }
	} catch {
		return null
	}
}

export function saveTextTablesCache(
	cacheDir: string,
	pdfPath: string,
	docIdx: number,
	chunks: TextChunk[],
	tables: TableChunk[],
): void {
	fs.mkdirSync(cacheDir, { recursive: true })
	const filePath = path.join(cacheDir, `doc${docIdx}_text_tables.json`)
	const fingerprint = getFingerprint(pdfPath)
	const data: TextTablesCache = {
		version: TEXT_TABLES_CACHE_VERSION,
		doc: docIdx,
		pdfPath,
		fingerprint: fingerprint ?? { mtime: 0, size: 0 },
		chunks,
		tables,
	}
	fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8')
}

function imageFilesExist(outputDir: string, images: ImageItem[]): boolean {
	for (const img of images) {
		const fullPath = path.join(outputDir, img.imgPath)
		if (!fs.existsSync(fullPath)) return false
	}
	return true
}

export function loadImagesCache(outputDir: string): ImageItem[] | null {
	const cacheDir = getCacheDir(outputDir)
	const filePath = path.join(cacheDir, 'images.json')
	if (!fs.existsSync(filePath)) return null

	try {
		const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ImagesCache
		if (data.version !== IMAGES_CACHE_VERSION || !imageFilesExist(outputDir, data.images))
			return null
		return data.images
	} catch {
		return null
	}
}

export function saveImagesCache(outputDir: string, images: ImageItem[]): void {
	const cacheDir = getCacheDir(outputDir)
	fs.mkdirSync(cacheDir, { recursive: true })
	const filePath = path.join(cacheDir, 'images.json')
	const data: ImagesCache = {
		version: IMAGES_CACHE_VERSION,
		fingerprint: { mtime: Date.now(), size: 0 },
		images,
	}
	fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8')
}
