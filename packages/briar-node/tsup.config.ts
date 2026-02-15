import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts", "src/jobs/*.ts"],
  format: ["esm"],
  target: "node20",
  sourcemap: true,
  clean: true,
  splitting: false,
  dts: false,
  shims: true,
})
