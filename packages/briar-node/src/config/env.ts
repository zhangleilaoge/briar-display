import dotenv from "dotenv"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const loadEnv = () => {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../.env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(__dirname, "../../../.env"),
  ]

  const envPath = candidates.find((candidate) => fs.existsSync(candidate))

  if (envPath) {
    dotenv.config({ path: envPath })
    return
  }

  dotenv.config()
}
