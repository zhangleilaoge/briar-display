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
    const outputJobsDir = "dist/jobs"

    if (!existsSync(outputJobsDir)) {
      mkdirSync(outputJobsDir, { recursive: true })
    }

    const { readdirSync } = await import("fs")
    const jobFiles = readdirSync(jobsDir)

    for (const file of jobFiles) {
      const srcPath = join(jobsDir, file)
      const destPath = join(outputJobsDir, file)
      copyFileSync(srcPath, destPath)
    }
  },
})
