import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prepareBackup } from './prepare'

describe('backup preparation authorization', () => {
  let db: PGlite
  const deviceA = '67c5f68b-13e4-48e7-9a64-2dc6dc68d905'
  const deviceB = 'c7dd6eb2-825b-448e-a54e-797112e55c32'
  const id = '8166d21c-bac3-497b-9d22-8492474c982b'
  const metadata = { id, contractVersion: 1, localRevision: 5, baseBackupId: null, manifestSha256: 'a'.repeat(64), sizeBytes: 100, includesHealth: false, healthConsent: false }
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(await readFile('server/migrations/001_accounts.sql', 'utf8'))
    await db.exec(await readFile('server/migrations/003_backups.sql', 'utf8'))
    await db.exec(await readFile('server/migrations/006_backup_retention.sql', 'utf8'))
    await db.exec("INSERT INTO arsen_profiles (user_id) VALUES ('a'), ('b');")
    await db.query('INSERT INTO arsen_devices (id, user_id) VALUES ($1, $2), ($3, $4)', [deviceA, 'a', deviceB, 'b'])
  }, 30_000)
  afterAll(async () => { await db?.close() })

  const request = (body: unknown) => new Request('https://api.test/backups', { method: 'POST', headers: { authorization: 'Bearer token', 'content-type': 'application/json' }, body: JSON.stringify(body) })
  function dependencies(userId = 'a') {
    return {
      auth: { verify: async () => userId, role: async () => 'user' as const },
      transaction: <T>(fn: (query: (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>) => Promise<T>) => db.transaction((tx) => fn((sql, params) => tx.query(sql, params))),
    }
  }

  it('rejects another user’s device and does not accept a client-supplied owner', async () => {
    expect(await prepareBackup(request({ deviceId: deviceB, backup: metadata }), dependencies())).toEqual({ status: 403 })
    expect(await prepareBackup(request({ deviceId: deviceA, backup: { ...metadata, userId: 'b' } }), dependencies())).toEqual({ status: 400 })
    expect((await db.query('SELECT id FROM arsen_backups')).rows).toEqual([])
  })

  it('rejects health data when the server has no stored consent even if the client claims consent', async () => {
    expect(await prepareBackup(request({ deviceId: deviceA, backup: { ...metadata, includesHealth: true, healthConsent: true } }), dependencies())).toEqual({ status: 403 })
    expect((await db.query('SELECT id FROM arsen_backups')).rows).toEqual([])
  })

  it('creates a pending version once and returns the same version on a retry', async () => {
    const body = { deviceId: deviceA, backup: metadata }
    expect(await prepareBackup(request(body), dependencies())).toEqual({ status: 201, id, state: 'pending', localRevision: 5, deviceId: deviceA })
    expect(await prepareBackup(request(body), dependencies())).toEqual({ status: 200, id, state: 'pending', localRevision: 5, deviceId: deviceA })
    expect((await db.query('SELECT id FROM arsen_backups')).rows).toHaveLength(1)
  })

  it('refuses a divergent base without modifying an existing version', async () => {
    await db.query("UPDATE arsen_backups SET status = 'confirmed', confirmed_at = now() WHERE id = $1", [id])
    const next = { ...metadata, id: 'c535e624-6166-4cc2-8858-17991596a999', manifestSha256: 'b'.repeat(64), localRevision: 6 }
    expect(await prepareBackup(request({ deviceId: deviceA, backup: next }), dependencies())).toEqual({ status: 409 })
    expect((await db.query('SELECT id FROM arsen_backups')).rows).toHaveLength(1)
  })

  it('accepts the confirmed base and a newer revision for the same device', async () => {
    const next = { ...metadata, id: 'c535e624-6166-4cc2-8858-17991596a999', baseBackupId: id, manifestSha256: 'b'.repeat(64), localRevision: 6 }
    expect(await prepareBackup(request({ deviceId: deviceA, backup: next }), dependencies())).toEqual({ status: 201, id: next.id, state: 'pending', localRevision: 6, deviceId: deviceA })
  })

  it('accepts health data only after consent is recorded for that user', async () => {
    await db.query('UPDATE arsen_profiles SET health_sync_consent = true WHERE user_id = $1', ['b'])
    const health = { ...metadata, id: '57d30b34-b8b4-4564-a4df-80ee6175d50a', manifestSha256: 'c'.repeat(64), includesHealth: true, healthConsent: true }
    expect(await prepareBackup(request({ deviceId: deviceB, backup: health }), dependencies('b'))).toEqual({ status: 201, id: health.id, state: 'pending', localRevision: 5, deviceId: deviceB })
  })

  it('rejects oversized metadata before creating a version', async () => {
    const count = (await db.query('SELECT id FROM arsen_backups')).rows.length
    expect(await prepareBackup(request({ deviceId: deviceA, backup: { ...metadata, extra: 'x'.repeat(5000) } }), dependencies())).toEqual({ status: 400 })
    expect((await db.query('SELECT id FROM arsen_backups')).rows).toHaveLength(count)
  })
  it('does not reuse an identifier whose objects are awaiting cleanup', async () => {
    const queued = 'fb4dc963-0762-4fd6-9704-8e6cabf5f4ee'
    await db.query("INSERT INTO arsen_backup_cleanup (backup_id,user_id,not_before) VALUES ($1,'a',now())", [queued])
    const next = { ...metadata, id: queued, baseBackupId: id, manifestSha256: 'd'.repeat(64), localRevision: 7 }
    expect(await prepareBackup(request({ deviceId: deviceA, backup: next }), dependencies())).toEqual({ status: 409 })
  })
})
