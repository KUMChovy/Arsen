import { describe, expect, it, vi } from 'vitest'
import { activateAccount } from './activationHandler'

describe('account activation transport', () => {
  it('requires a verified session and does not query the user for an invalid token', async () => {
    const getUser = vi.fn(async () => ({ userId: 'user_a', verifiedEmail: null, invitationId: null }))
    const dependencies = { verify: async () => { throw new Error('invalid') }, getUser, query: async () => ({ rows: [] }) }
    expect(await activateAccount(new Request('https://api.test', { method: 'POST' }), dependencies)).toEqual({ status: 401 })
    expect(await activateAccount(new Request('https://api.test', { method: 'POST', headers: { authorization: 'Bearer invalid' } }), dependencies)).toEqual({ status: 401 })
    expect(getUser).not.toHaveBeenCalled()
  })
  it('rejects an identity without a verified invitation', async () => {
    const dependencies = { verify: async () => 'user_a', getUser: async () => ({ userId: 'user_a', verifiedEmail: 'a@example.test', invitationId: null }), query: async () => ({ rows: [] }) }
    expect(await activateAccount(new Request('https://api.test', { method: 'POST', headers: { authorization: 'Bearer valid' } }), dependencies)).toEqual({ status: 403 })
  })
})
