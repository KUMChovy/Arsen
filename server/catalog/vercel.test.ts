import { afterEach, expect, it, vi } from 'vitest'
import catalog from '../../api/v1/catalog'
import version from '../../api/v1/catalog/version'

afterEach(() => vi.unstubAllEnvs())

it('does not expose public endpoints before deployment configuration is enabled', async () => {
  vi.stubEnv('CATALOG_PUBLIC_ENABLED', '')
  vi.stubEnv('DATABASE_URL', '')
  expect((await catalog.fetch(new Request('https://api.test/api/v1/catalog'))).status).toBe(503)
  expect((await version.fetch(new Request('https://api.test/api/v1/catalog/version'))).status).toBe(503)
})
