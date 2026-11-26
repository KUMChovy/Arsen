import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteAdminAccount } from './deleteAccount'

describe('account deletion', () => {
  let db: PGlite
  const device = '67c5f68b-13e4-48e7-9a64-2dc6dc68d905'
  const backup = '8166d21c-bac3-497b-9d22-8492474c982b'
  const transaction = <T>(fn: (query: (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>) => Promise<T>) => db.transaction((tx) => fn((sql, params) => tx.query(sql, params)))
  const auth = { verify: async (token: string) => token, role: async (id: string) => id === 'user_admin' ? 'admin' as const : 'user' as const }
  const request = (token?: string) => new Request('https://api.test/api/v1/admin/accounts/delete', { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {} })
  const dependencies = () => ({ auth, issuer: 'https://clerk.example', storeFingerprint: () => 'a'.repeat(64), transaction, ban: vi.fn(async () => {}), deleteIdentity: vi.fn(async () => {}), list: vi.fn(async (_prefix: string, _limit: number): Promise<string[]> => []), remove: vi.fn(async (_paths: string[]) => {}) })
  beforeEach(async () => {
    db = new PGlite()
    for (const file of ['001_accounts.sql', '003_backups.sql', '004_backup_components.sql', '006_backup_retention.sql', '008_account_deletions.sql']) await db.exec(await readFile(`server/migrations/${file}`, 'utf8'))
    await db.exec("INSERT INTO arsen_profiles (user_id, role) VALUES ('user_admin','admin'), ('user_a','user'), ('user_b','user')")
    await db.query("INSERT INTO arsen_devices (id,user_id) VALUES ($1,'user_a')", [device])
    await db.query("INSERT INTO arsen_backups (id,user_id,device_id,contract_version,local_revision,manifest_sha256,size_bytes) VALUES ($1,'user_a',$2,1,1,$3,1)", [backup, device, 'a'.repeat(64)])
  }, 30000)
  afterEach(async () => { await db?.close() })
  it('denies users and self-deletion without modifying anything', async () => {
    const deps = dependencies()
    expect(await deleteAdminAccount(request(), 'user_a', deps)).toEqual({ status: 401 })
    expect(await deleteAdminAccount(request('user_a'), 'user_b', deps)).toEqual({ status: 403 })
    expect(await deleteAdminAccount(request('user_admin'), 'user_admin', deps)).toEqual({ status: 403 })
    expect(deps.ban).not.toHaveBeenCalled()
  })
  it('records a resumable request before attempting to ban the identity', async () => {
    const deps = dependencies()
    deps.ban.mockRejectedValueOnce(new Error('network timeout'))
    await expect(deleteAdminAccount(request('user_admin'), 'user_a', deps)).rejects.toThrow()
    expect((await db.query('SELECT user_id FROM arsen_account_deletions')).rows).toEqual([{ user_id: 'user_a' }])
    expect(await deleteAdminAccount(request('user_admin'), 'user_a', deps)).toEqual({ status: 200, result: 'waiting' })
  })
  it('bans access, waits, removes bounded private objects and only then deletes identity and data', async () => {
    const deps = dependencies()
    await db.query("INSERT INTO arsen_invitations (id,email,token_sha256,expires_at,accepted_at,accepted_by) VALUES ($1,'a@example.test',$2,now(),now(),'user_a')", ['c535e624-6166-4cc2-8858-17991596a999', 'b'.repeat(64)])
    expect(await deleteAdminAccount(request('user_admin'), 'user_a', deps)).toEqual({ status: 200, result: 'waiting' })
    expect(deps.ban).toHaveBeenCalledWith('user_a')
    expect(await deleteAdminAccount(request('user_admin'), 'user_a', deps)).toEqual({ status: 200, result: 'waiting' })
    expect(deps.list).not.toHaveBeenCalled()
    await db.exec("UPDATE arsen_account_deletions SET not_before = now() - interval '1 second'")
    deps.list.mockImplementationOnce(async (prefix) => [`${prefix}${backup}/manifest`])
    expect(await deleteAdminAccount(request('user_admin'), 'user_a', deps)).toEqual({ status: 200, result: 'pending' })
    expect(deps.deleteIdentity).not.toHaveBeenCalled()
    expect(await deleteAdminAccount(request('user_admin'), 'user_a', deps)).toEqual({ status: 200, result: 'complete' })
    expect(deps.deleteIdentity).toHaveBeenCalledWith('user_a')
    expect((await db.query("SELECT user_id FROM arsen_profiles WHERE user_id IN ('user_a','user_b') ORDER BY user_id")).rows).toEqual([{ user_id: 'user_b' }])
    expect((await db.query('SELECT id FROM arsen_backups')).rows).toEqual([])
    expect((await db.query("SELECT id FROM arsen_invitations WHERE accepted_by = 'user_a'")).rows).toEqual([])
  })
  it('keeps the pending job and account when storage or identity fails', async () => {
    const deps = dependencies()
    await deleteAdminAccount(request('user_admin'), 'user_a', deps)
    await db.exec("UPDATE arsen_account_deletions SET not_before = now() - interval '1 second'")
    deps.list.mockRejectedValueOnce(new Error('offline'))
    await expect(deleteAdminAccount(request('user_admin'), 'user_a', deps)).rejects.toThrow()
    expect((await db.query('SELECT user_id FROM arsen_account_deletions')).rows).toEqual([{ user_id: 'user_a' }])
    expect((await db.query("SELECT user_id FROM arsen_profiles WHERE user_id = 'user_a'")).rows).toHaveLength(1)
    deps.deleteIdentity.mockRejectedValueOnce(new Error('identity offline'))
    await expect(deleteAdminAccount(request('user_admin'), 'user_a', deps)).rejects.toThrow()
    expect((await db.query('SELECT user_id FROM arsen_account_deletions')).rows).toEqual([{ user_id: 'user_a' }])
    expect((await db.query("SELECT user_id FROM arsen_profiles WHERE user_id = 'user_a'")).rows).toHaveLength(1)
  })
  it('does not continue if the Clerk environment changes mid-process', async () => {
    const deps = dependencies()
    await deleteAdminAccount(request('user_admin'), 'user_a', deps)
    await db.exec("UPDATE arsen_account_deletions SET not_before = now() - interval '1 second'")
    await expect(deleteAdminAccount(request('user_admin'), 'user_a', { ...deps, issuer: 'https://other.example' })).rejects.toThrow('entorno de identidad')
    expect(deps.list).not.toHaveBeenCalled()
    expect(deps.deleteIdentity).not.toHaveBeenCalled()
  })
  it('does not delete identity or data if the private storage credential changes', async () => {
    const deps = dependencies()
    await deleteAdminAccount(request('user_admin'), 'user_a', deps)
    await db.exec("UPDATE arsen_account_deletions SET not_before = now() - interval '1 second'")
    await expect(deleteAdminAccount(request('user_admin'), 'user_a', { ...deps, storeFingerprint: () => 'b'.repeat(64) })).rejects.toThrow('almacén')
    expect(deps.list).not.toHaveBeenCalled()
    expect(deps.deleteIdentity).not.toHaveBeenCalled()
  })
  it('refuses an unrelated object path and protects administrators already being deleted', async () => {
    const deps = dependencies()
    await deleteAdminAccount(request('user_admin'), 'user_a', deps)
    await db.exec("UPDATE arsen_account_deletions SET not_before = now() - interval '1 second'")
    deps.list.mockResolvedValueOnce(['backups/another-user/file'])
    await expect(deleteAdminAccount(request('user_admin'), 'user_a', deps)).rejects.toThrow()
    expect(deps.remove).not.toHaveBeenCalled()
    expect(deps.deleteIdentity).not.toHaveBeenCalled()
    await db.exec("INSERT INTO arsen_account_deletions (user_id,requested_by,issuer,store_fingerprint,not_before) VALUES ('user_admin','user_admin','https://clerk.example',repeat('a',64),now())")
    expect(await deleteAdminAccount(request('user_admin'), 'user_b', deps)).toEqual({ status: 403 })
  })
  it('prevents deleting the last administrator not already pending deletion', async () => {
    const deps = dependencies()
    await db.exec("INSERT INTO arsen_profiles (user_id,role) VALUES ('user_admin2','admin'); INSERT INTO arsen_account_deletions (user_id,requested_by,issuer,store_fingerprint,not_before) VALUES ('user_admin2','user_admin','https://clerk.example',repeat('a',64),now())")
    expect(await deleteAdminAccount(request('user_admin2'), 'user_admin', { ...deps, auth: { ...auth, role: async () => 'admin' as const } })).toEqual({ status: 403 })
  })
})
