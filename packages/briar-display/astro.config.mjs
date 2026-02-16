// @ts-check
import { defineConfig } from "astro/config"
import vue from "@astrojs/vue"
import react from "@astrojs/react"
import tailwind from "@astrojs/tailwind"
import { fileURLToPath } from "url"
import { loadEnv } from "@briar/shared/env"

loadEnv(import.meta.url)

const isBuildDev = process.env.BUILD_DEV === "true"
const cdnBase = process.env.BRIAR_TX_BUCKET_DOMAIN?.replace(/\/+$/, "")
const cdnPrefix = "static"
const assetsPrefix =
  !isBuildDev && cdnBase ? `${cdnBase}/${cdnPrefix}` : undefined

// https://astro.build/config
export default defineConfig({
  integrations: [react(), vue(), tailwind()],
  build: assetsPrefix ? { assetsPrefix } : undefined,
  vite: {
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  },
})
