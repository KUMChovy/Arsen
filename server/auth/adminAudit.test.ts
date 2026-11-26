import { describe, expect, it, vi } from 'vitest'
import { getAdminAudit } from './adminAudit'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

describe('administrative audit', () => {
  it('rejects non-administrators before accessing audit data', async () => {
    const query = vi.fn(async () => ({ rows: [] }))
    const auth = { verify: async () => 'user_test', role: async () => 'user' as const }
    const result = await getAdminAudit(new Request('https://api.example.test', { headers: { authorization: 'Bearer test' } }), { auth, query })
    expect(result.status).toBe(403)
    expect(query).not.toHaveBeenCalled()
  })

  it('returns bounded administrative events without their payloads', async () => {
    const query = vi.fn(async (_sql: string, _params: string[]) => ({ rows: [{ actor_id: 'user_admin', action: 'publish', target_id: 'sentadilla', created_at: '2026-11-24T12:00:00.000Z' }] }))
    const auth = { verify: async () => 'user_admin', role: async () => 'admin' as const }
    const result = await getAdminAudit(new Request('https://api.example.test', { headers: { authorization: 'Bearer test' } }), { auth, query })
    expect(result).toMatchObject({ status: 200, events: [{ action: 'publish', target_id: 'sentadilla' }] })
    expect(query.mock.calls[0]?.[0]).toContain('LIMIT 100')
    expect(query.mock.calls[0]?.[0]).not.toContain('payload')
  })

  it('reads all three audit sources from PostgreSQL', async () => {
    const pg = new PGlite()
    try {
      for (const name of ['002_catalog.sql', '005_admin_audit.sql', '007_catalog_draft_audit.sql', '008_account_deletions.sql']) await pg.exec(await readFile(`server/migrations/${name}`, 'utf8'))
      await pg.exec("INSERT INTO arsen_admin_audit (actor_id, action, target_id) VALUES ('admin', 'invitation.requested', '8166d21c-bac3-497b-9d22-8492474c982b'); INSERT INTO arsen_catalog_items (id, draft) VALUES ('squat', '{}'); INSERT INTO arsen_catalog_draft_audit (actor_id, action, target_id) VALUES ('admin', 'draft.save', 'squat'); INSERT INTO arsen_catalog_changes (version, item_id, action, actor_id, payload) VALUES (1, 'squat', 'publish', 'admin', '{}')")
      await pg.exec("INSERT INTO arsen_account_deletion_audit (actor_id, target_id, action) VALUES ('admin', 'user_a', 'requested')")
      const auth = { verify: async () => 'admin', role: async () => 'admin' as const }
      const result = await getAdminAudit(new Request('https://api.example.test', { headers: { authorization: 'Bearer test' } }), { auth, query: (sql, params) => pg.query(sql, params) })
      expect(result.status).toBe(200)
      if (result.status === 200) expect(result.events.map((event) => event.action).sort()).toEqual(['account.deletion.requested', 'draft.save', 'invitation.requested', 'publish'])
    } finally { await pg.close() }
  }, 30_000)
})
