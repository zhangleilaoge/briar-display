// @ts-check
import { defineConfig } from "astro/config"
import vue from "@astrojs/vue"
import react from "@astrojs/react"
import tailwind from "@astrojs/tailwind"
import { fileURLToPath } from "url"

const cdnBase = process.env.BRIAR_TX_BUCKET_DOMAIN?.replace(/\/+$/, "")
const cdnPrefix = "briar-display/static"
const assetsPrefix = cdnBase ? `${cdnBase}/${cdnPrefix}` : undefined

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
