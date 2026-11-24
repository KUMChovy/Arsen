import { describe, expect, it, vi } from 'vitest'
import { loadAdminClerk } from './clerk'

describe('admin Clerk loader', () => {
  const key = `pk_test_${btoa('train.clerk.accounts.dev$')}`
  it('loads official UI and SDK from the configured Clerk domain before initializing', async () => {
    const loadScript = vi.fn(async () => {})
    const sdk = { load: vi.fn(async () => {}), session: null, openSignIn: vi.fn(), signOut: vi.fn(), addListener: vi.fn() }
    const ui = function ClerkUI() {}
    const result = await loadAdminClerk(key, { loadScript, getSdk: () => sdk, getUi: () => ui })
    expect(result).toBe(sdk)
    expect(loadScript).toHaveBeenNthCalledWith(1, 'https://train.clerk.accounts.dev/npm/@clerk/ui@1/dist/ui.browser.js', undefined)
    expect(loadScript).toHaveBeenNthCalledWith(2, 'https://train.clerk.accounts.dev/npm/@clerk/clerk-js@6/dist/clerk.browser.js', key)
    expect(sdk.load).toHaveBeenCalledWith({ ui: { ClerkUI: ui } })
  })
  it('rejects secrets, malformed keys and untrusted development hosts before loading scripts', async () => {
    const loadScript = vi.fn(async () => {})
    const dependencies = { loadScript, getSdk: () => null, getUi: () => null }
    await expect(loadAdminClerk('sk_test_secret', dependencies)).rejects.toThrow()
    await expect(loadAdminClerk(`pk_test_${btoa('evil.example$')}`, dependencies)).rejects.toThrow()
    await expect(loadAdminClerk(`pk_test_${btoa('127.0.0.1$')}`, dependencies)).rejects.toThrow()
    expect(loadScript).not.toHaveBeenCalled()
  })
})
