import { describe, expect, it, vi } from 'vitest'
import { createClerkDeletionClient } from './clerkDeleteAccount'

describe('Clerk account deletion adapter', () => {
  it('bans only the selected identity and handles an already banned account', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ id: 'user_a', banned: false })).mockResolvedValueOnce(Response.json({ id: 'user_a', banned: true })).mockResolvedValueOnce(Response.json({ id: 'user_a', banned: true }))
    const client = createClerkDeletionClient('server-secret', fetcher)
    await client.ban('user_a')
    await client.ban('user_a')
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(fetcher.mock.calls[1]?.[0]).toBe('https://api.clerk.com/v1/users/user_a/ban')
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({ method: 'POST', redirect: 'error' })
  })
  it('retries a missing identity only during the deletion stage and rejects unexpected results', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(Response.json({ errors: [{ code: 'resource_not_found' }] }, { status: 404 })).mockResolvedValueOnce(Response.json({ id: 'user_other', banned: false })).mockResolvedValueOnce(new Response(null, { status: 404 }))
    const client = createClerkDeletionClient('server-secret', fetcher)
    await expect(client.ban('user_a')).rejects.toThrow()
    await expect(client.deleteIdentity('user_a')).resolves.toBeUndefined()
    await expect(client.ban('user_a')).rejects.toThrow()
    await expect(client.deleteIdentity('user_a')).rejects.toThrow()
  })
  it('allows a confirmed missing Clerk identity to proceed while rejecting ambiguous 404s', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ errors: [{ code: 'resource_not_found' }] }, { status: 404 }))
      .mockResolvedValueOnce(Response.json({ errors: [{ code: 'other_error' }] }, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
    const client = createClerkDeletionClient('server-secret', fetcher)
    await expect(client.ban('user_a')).resolves.toBeUndefined()
    await expect(client.ban('user_a')).rejects.toThrow()
    await expect(client.ban('user_a')).rejects.toThrow()
  })
})
