import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('server deployment bundle', () => {
  it('starts in Node and keeps unconfigured private routes closed', () => {
    execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--config', 'server/vite.config.ts'], { stdio: 'pipe' })
    const script = `import('./api/gateway.mjs').then(async m => { const response = await m.default.fetch(new Request('https://example.test/api/v1/account')); if (response.status !== 503) process.exit(1) })`
    execFileSync(process.execPath, ['-e', script], { stdio: 'pipe', env: { ...process.env, ACCOUNT_API_ENABLED: 'false' } })
    expect(true).toBe(true)
  }, 30000)
})
