import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

export const loadEnv = (currentFilePath?: string) => {
	const dirname = currentFilePath ? path.dirname(fileURLToPath(currentFilePath)) : process.cwd()

	const candidates = [
		path.resolve(process.cwd(), '.env'),
		path.resolve(process.cwd(), '../.env'),
		path.resolve(process.cwd(), '../../.env'),
		path.resolve(dirname, '../../../.env'),
	]

	const envPath = candidates.find((candidate) => fs.existsSync(candidate))

	if (envPath) {
		dotenv.config({ path: envPath })
		return envPath
	}

	dotenv.config()
	return null
}
