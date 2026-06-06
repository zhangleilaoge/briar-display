import * as fs from 'fs'
import * as path from 'path'

export function findRepoRoot(startDir: string): string {
	let currentDir = startDir
	while (true) {
		if (fs.existsSync(path.join(currentDir, 'bun.lock'))) {
			return currentDir
		}
		const parentDir = path.dirname(currentDir)
		if (parentDir === currentDir) {
			return startDir
		}
		currentDir = parentDir
	}
}
