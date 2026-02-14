// @ts-check
import { defineConfig } from "astro/config"
import vue from "@astrojs/vue"
import react from "@astrojs/react"
import tailwind from "@astrojs/tailwind"
import { fileURLToPath } from "url"

// https://astro.build/config
export default defineConfig({
  integrations: [react(), vue(), tailwind()],
  vite: {
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  },
})
