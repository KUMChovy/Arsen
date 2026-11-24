import { describe, expect, it, vi } from 'vitest'
import { createClerkInvitationClient } from './clerkInvitations'

describe('Clerk invitation provider', () => {
  const marker = 'cdeedb17-0c4c-4eb5-a9fc-a567a5b377f8'
  it('checks every page and matches the exact email and marker', async () => {
    const first = Array.from({ length: 100 }, (_, index) => ({ email_address: `other${index}@example.test`, public_metadata: {}, status: 'pending' }))
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      const offset = new URL(String(url)).searchParams.get('offset')
      const data = offset === '0' ? first : [{ email_address: 'user@example.test', public_metadata: { arsen_invitation_id: marker }, status: 'pending' }]
      return new Response(JSON.stringify({ data, total_count: 101 }))
    })
    const client = createClerkInvitationClient('sk_test_example', fetcher)
    await expect(client.find(marker, 'user@example.test')).resolves.toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('creates an invitation with server-owned metadata and seven day expiration', async () => {
    const fetcher = vi.fn(async () => new Response('{}', { status: 200 }))
    await createClerkInvitationClient('sk_test_example', fetcher).create(marker, 'user@example.test')
    const [, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(String(options.body))).toEqual({ email_address: 'user@example.test', public_metadata: { arsen_invitation_id: marker }, expires_in_days: 7, notify: true, ignore_existing: false })
    expect(new Headers(options.headers).get('authorization')).toBe('Bearer sk_test_example')
  })
  it('does not treat malformed or failed responses as proof an invitation is absent', async () => {
    const invalid = createClerkInvitationClient('sk_test_example', async () => new Response('{}'))
    await expect(invalid.find(marker, 'user@example.test')).rejects.toThrow()
    const failed = createClerkInvitationClient('sk_test_example', async () => new Response(null, { status: 503 }))
    await expect(failed.find(marker, 'user@example.test')).rejects.toThrow()
  })
  it('does not recreate an invitation that was revoked in Clerk', async () => {
    const client = createClerkInvitationClient('sk_test_example', async (url) => {
      const revoked = new URL(String(url)).searchParams.get('status') === 'revoked'
      return new Response(JSON.stringify(revoked ? [{ email_address: 'user@example.test', public_metadata: { arsen_invitation_id: marker }, status: 'revoked' }] : []))
    })
    await expect(client.find(marker, 'user@example.test')).rejects.toThrow()
  })
})
