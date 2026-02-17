// @ts-check
import { defineConfig } from "astro/config"
import vue from "@astrojs/vue"
import react from "@astrojs/react"
import tailwind from "@astrojs/tailwind"
import starlight from "@astrojs/starlight"
import { fileURLToPath } from "url"
import { loadEnv } from "@briar/shared/env"

loadEnv(import.meta.url)

const isBuildDev = process.env.BUILD_DEV === "true"
const cdnBase = process.env.BRIAR_TX_BUCKET_DOMAIN?.replace(/\/+$/, "")
const cdnPrefix = "static"
const assetsPrefix =
  !isBuildDev && cdnBase ? `${cdnBase}/${cdnPrefix}` : undefined

console.log("CDN Base:", assetsPrefix)

// https://astro.build/config
export default defineConfig({
  integrations: [
    react(),
    vue(),
    tailwind(),
    starlight({
      title: "Briar Wiki",
      description: "Documentation and guides for Briar",
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "Welcome", slug: "getting-started/welcome" },
            { label: "Articles", slug: "getting-started/articles" },
          ],
        },
        {
          label: "Guides",
          items: [{ label: "How to Write", slug: "guides/write" }],
        },
      ],
      social: [
        {
          icon: "github",
          href: "https://github.com/yourusername/briar",
          label: "GitHub",
        },
      ],
      customCss: ["./src/styles/starlight.css"],
    }),
  ],
  build: assetsPrefix ? { assetsPrefix } : undefined,
  vite: {
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  },
})
