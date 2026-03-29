const demoServiceUrl = new URL('../services/demoService.ts', import.meta.url).href

const { tsImport } = await import('tsx/esm/api')
const { demoService } = await tsImport(demoServiceUrl, demoServiceUrl)

demoService.helloWorld()
