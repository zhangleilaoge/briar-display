import { fileURLToPath } from "url"
import type { SchedulerTask } from "./scheduler"

const resolveCron = (envKey: string, fallbackCron: string) => {
  const raw = process.env[envKey]
  return raw && raw.trim().length > 0 ? raw : fallbackCron
}

export const schedulerTasks: SchedulerTask[] = [
  {
    name: "demo-hello-world",
    cron: resolveCron("BRIAR_DEMO_CRON", "*/1 * * * *"),
    runOnStart: true,
    path: fileURLToPath(
      new URL("../jobs/demo-hello-world.mjs", import.meta.url),
    ),
  },
  {
    name: "cleanup-verification-codes",
    cron: resolveCron("BRIAR_CLEANUP_CODES_CRON", "0 0 * * *"),
    path: fileURLToPath(
      new URL("../jobs/cleanup-verification-codes.mjs", import.meta.url),
    ),
  },
  // {
  //   name: "renew-certificates",
  //   cron: resolveCron("BRIAR_RENEW_CERT_CRON", "0 2 1 * *"), // 每月1日 02:00 UTC
  //   runOnStart: false,
  //   path: fileURLToPath(
  //     new URL("../jobs/renew-certificates.mjs", import.meta.url),
  //   ),
  // },
]
