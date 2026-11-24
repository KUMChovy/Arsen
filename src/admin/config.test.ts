import { describe, expect, it } from 'vitest'
import { getStableAdminToken, readAdminConfig } from './config'
import type { AdminClerk } from './clerk'

describe('admin configuration', () => {
  it('accepts only a public key and an explicit HTTPS API origin', () => {
    expect(readAdminConfig('pk_test_abc123', 'https://api.example.test', 'https://admin.example.test')).toEqual({ publishableKey: 'pk_test_abc123', apiOrigin: 'https://api.example.test' })
    expect(readAdminConfig('pk_test_abc123', '', 'https://admin.example.test').apiOrigin).toBe('https://admin.example.test')
    expect(() => readAdminConfig('sk_test_secret', '', 'https://admin.example.test')).toThrow()
    expect(() => readAdminConfig('pk_test_abc123', 'http://api.example.test', 'https://admin.example.test')).toThrow()
    expect(() => readAdminConfig('pk_test_abc123', 'https://api.example.test/path', 'https://admin.example.test')).toThrow()
  })
  it('does not return a token after the active session changes', async () => {
    let resolve!: (value: string) => void
    const session = { id: 'sess_a', getToken: () => new Promise<string>((done) => { resolve = done }) }
    const clerk = { session } as unknown as AdminClerk
    const pending = getStableAdminToken(clerk)
    clerk.session = null
    resolve('token')
    expect(await pending).toBeNull()
    expect(await getStableAdminToken(clerk)).toBeNull()
  })
})
