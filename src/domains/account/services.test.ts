import { beforeEach, describe, expect, it, vi } from 'vitest'
import { completeVerification, getAccountState, signIn, signOut } from './services'
import { isNativeAccount, nativeAccount } from './native'

vi.mock('./native', () => ({
  isNativeAccount: vi.fn(),
  nativeAccount: { getState: vi.fn(), signIn: vi.fn(), completeVerification: vi.fn(), signOut: vi.fn() },
}))

describe('native account services', () => {
  beforeEach(() => { vi.resetAllMocks() })
  it('leaves browser users in guest mode without contacting the plugin', async () => {
    vi.mocked(isNativeAccount).mockReturnValue(false)
    expect(await getAccountState()).toEqual({ status: 'unavailable' })
    expect(await signIn('test@example.test', 'secret')).toEqual({ status: 'unavailable' })
    expect(await completeVerification()).toEqual({ status: 'unavailable' })
    await expect(signOut()).rejects.toThrow()
    expect(nativeAccount.signIn).not.toHaveBeenCalled()
  })
  it('validates credentials and passes them only to the native plugin', async () => {
    vi.mocked(isNativeAccount).mockReturnValue(true)
    vi.mocked(nativeAccount.signIn).mockResolvedValue({ status: 'verification-required' })
    await expect(signIn(' ', 'secret')).rejects.toThrow()
    await expect(signIn('test@example.test', '')).rejects.toThrow()
    expect(nativeAccount.signIn).not.toHaveBeenCalled()
    expect(await signIn(' test@example.test ', 'secret')).toEqual({ status: 'verification-required' })
    expect(nativeAccount.signIn).toHaveBeenCalledWith({ email: 'test@example.test', password: 'secret' })
  })
})
