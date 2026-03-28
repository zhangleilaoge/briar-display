import { defineConfig } from "tsup"
import { copyFileSync, mkdirSync, existsSync } from "fs"
import { join, dirname } from "path"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  sourcemap: true,
  clean: true,
  splitting: false,
  dts: false,
  shims: true,
  onSuccess: async () => {
    const jobsDir = "src/jobs"
    // Copy to both dist/jobs (for imports) and jobs/ (for Bree root)
    const outputJobsDirs = ["dist/jobs", "jobs"]

    const { readdirSync } = await import("fs")
    const jobFiles = readdirSync(jobsDir)

    for (const outputJobsDir of outputJobsDirs) {
      if (!existsSync(outputJobsDir)) {
        mkdirSync(outputJobsDir, { recursive: true })
      }

      for (const file of jobFiles) {
        const srcPath = join(jobsDir, file)
        const destPath = join(outputJobsDir, file)
        copyFileSync(srcPath, destPath)
      }
    }
  },
})
