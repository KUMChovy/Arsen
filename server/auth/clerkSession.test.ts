import { describe, expect, it, vi } from 'vitest'
import { createClerkSessionReader, createClerkUserReader } from './clerkSession'

describe('Clerk backend session reader', () => {
  it('fetches and maps a session using only the server secret', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ id: 'sess_a', user_id: 'user_a', status: 'active' }), { status: 200 }))
    const read = createClerkSessionReader('sk_test_example', fetcher)
    await expect(read('sess_a')).resolves.toEqual({ id: 'sess_a', userId: 'user_a', status: 'active' })
    expect(fetcher).toHaveBeenCalledOnce()
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.clerk.com/v1/sessions/sess_a')
    expect(new Headers(options.headers).get('authorization')).toBe('Bearer sk_test_example')
  })
  it('fails closed on malformed identifiers, failed requests and invalid responses', async () => {
    const fetcher = vi.fn(async () => new Response('{}', { status: 200 }))
    const read = createClerkSessionReader('sk_test_example', fetcher)
    await expect(read('../users/a')).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
    await expect(read('sess_a')).rejects.toThrow()
    const failed = createClerkSessionReader('sk_test_example', async () => new Response(null, { status: 503 }))
    await expect(failed('sess_a')).rejects.toThrow()
  })
})

describe('Clerk verified identity reader', () => {
  const user = { id: 'user_a', banned: false, locked: false, deprovisioned: false, public_metadata: { arsen_invitation_id: 'cdeedb17-0c4c-4eb5-a9fc-a567a5b377f8' }, primary_email_address_id: 'idn_primary', email_addresses: [
    { id: 'idn_primary', email_address: 'owner@example.test', verification: { status: 'verified' } },
    { id: 'idn_other', email_address: 'other@example.test', verification: { status: 'verified' } },
  ] }
  it('returns only the verified primary email for the requested user', async () => {
    const read = createClerkUserReader('sk_test_example', async () => new Response(JSON.stringify(user)))
    await expect(read('user_a')).resolves.toEqual({ userId: 'user_a', verifiedEmail: 'owner@example.test', invitationId: 'cdeedb17-0c4c-4eb5-a9fc-a567a5b377f8' })
    await expect(read('user_b')).rejects.toThrow()
  })
  it('denies blocked accounts and does not treat unverified email as verified', async () => {
    const read = (payload: unknown) => createClerkUserReader('sk_test_example', async () => new Response(JSON.stringify(payload)))('user_a')
    await expect(read({ ...user, banned: true })).rejects.toThrow()
    await expect(read({ ...user, locked: true })).rejects.toThrow()
    await expect(read({ ...user, deprovisioned: true })).rejects.toThrow()
    await expect(read({ ...user, email_addresses: [{ ...user.email_addresses[0], verification: { status: 'unverified' } }] })).resolves.toEqual({ userId: 'user_a', verifiedEmail: null, invitationId: user.public_metadata.arsen_invitation_id })
    await expect(read({ ...user, public_metadata: {} })).resolves.toEqual({ userId: 'user_a', verifiedEmail: 'owner@example.test', invitationId: null })
  })
})
