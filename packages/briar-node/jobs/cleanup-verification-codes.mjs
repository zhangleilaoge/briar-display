const maintenanceServiceUrl = new URL('../services/maintenanceService.ts', import.meta.url).href

const { tsImport } = await import('tsx/esm/api')
const { maintenanceService } = await tsImport(maintenanceServiceUrl, maintenanceServiceUrl)

await maintenanceService.clearAllVerificationCodes()
