import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { issueClerkInvitation } from './issueClerkInvitation'

describe('recoverable Clerk invitations', () => {
  let db: PGlite
  const id = 'cdeedb17-0c4c-4eb5-a9fc-a567a5b377f8'
  const sent = new Map<string, string>()
  let attempts = 0
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(await readFile('server/migrations/001_accounts.sql', 'utf8'))
    await db.exec(await readFile('server/migrations/005_admin_audit.sql', 'utf8'))
  }, 30_000)
  afterAll(async () => { await db?.close() })
  const request = new Request('https://api.example.test', { method: 'POST', headers: { authorization: 'Bearer session' } })
  const dependencies = (role: 'user' | 'admin' = 'admin') => ({
    auth: { verify: async () => 'admin', role: async () => role },
    query: (sql: string, params: string[]) => db.query<Record<string, unknown>>(sql, params),
    find: async (marker: string, email: string) => sent.get(marker) === email,
    create: async (marker: string, email: string) => { attempts++; sent.set(marker, email) },
  })
  it('rejects unauthorized users and invalid input before creating an invitation', async () => {
    expect(await issueClerkInvitation(request, { id, email: 'user@example.test' }, dependencies('user'))).toEqual({ status: 403 })
    expect(await issueClerkInvitation(request, { id, email: 'bad' }, dependencies())).toEqual({ status: 400 })
    expect((await db.query('SELECT id FROM arsen_invitations')).rows).toEqual([])
  })
  it('recovers after the provider sends an invitation but its response is lost', async () => {
    const deps = dependencies()
    const lost = { ...deps, create: async (marker: string, email: string) => { await deps.create(marker, email); throw new Error('timeout') } }
    expect(await issueClerkInvitation(request, { id, email: 'User@example.test' }, lost)).toEqual({ status: 503 })
    expect(await issueClerkInvitation(request, { id, email: 'user@example.test' }, deps)).toEqual({ status: 200, id })
    expect(attempts).toBe(1)
    expect(await issueClerkInvitation(request, { id, email: 'other@example.test' }, deps)).toEqual({ status: 409 })
    expect((await db.query('SELECT actor_id, action, target_id FROM arsen_admin_audit')).rows).toEqual([{ actor_id: 'admin', action: 'invitation.requested', target_id: id }])
  })
  it('does not contact Clerk if recording the audit fails', async () => {
    await db.exec("CREATE FUNCTION reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit failure'; END $$; CREATE TRIGGER reject_audit BEFORE INSERT ON arsen_admin_audit FOR EACH ROW EXECUTE FUNCTION reject_audit();")
    const another = 'c535e624-6166-4cc2-8858-17991596a999'
    await expect(issueClerkInvitation(request, { id: another, email: 'another@example.test' }, dependencies())).rejects.toThrow()
    expect(sent.has(another)).toBe(false)
    expect((await db.query('SELECT id FROM arsen_invitations WHERE id = $1', [another])).rows).toEqual([])
  })
})
