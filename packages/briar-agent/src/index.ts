// Export main client
export { KimiCode } from './client/index.js'

// Export session classes
export { Session } from './client/sessions.js'

// Re-export types from claude-code-sdk
export * from 'claude-code-sdk/dist/types/index.js'

// Export Kimi-specific implementations
export { KimiApiExecutor } from './implementations/api.js'
export { KimiCliExecutor } from './implementations/cli.js'

// Default export
export { KimiCode as default } from './client/index.js'
