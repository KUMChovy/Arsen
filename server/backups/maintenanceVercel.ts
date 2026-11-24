import { createNeonTransactionRunner } from '../db/neonTransaction'
import { cleanupOneBackup } from './cleanup'
import { expireOnePendingBackup } from './expirePending'
import { createCleanupHandler, runBackupMaintenance } from './maintenance'
import { createVercelCleanup } from './vercelCleanup'

export async function serveCleanup(request: Request): Promise<Response> {
  const { BACKUP_MAINTENANCE_ENABLED, DATABASE_URL, BLOB_READ_WRITE_TOKEN, CRON_SECRET } = process.env
  if (BACKUP_MAINTENANCE_ENABLED !== 'true' || !DATABASE_URL || !BLOB_READ_WRITE_TOKEN || !CRON_SECRET) return new Response(null, { status: 503, headers: { 'cache-control': 'no-store' } })
  try {
    return await createCleanupHandler(CRON_SECRET, async () => {
      const db = createNeonTransactionRunner(DATABASE_URL)
      try { return await runBackupMaintenance(() => cleanupOneBackup({ transaction: db.run, ...createVercelCleanup() }), () => expireOnePendingBackup({ transaction: db.run })) } finally { await db.close() }
    })(request)
  } catch { return new Response(null, { status: 503, headers: { 'cache-control': 'no-store' } }) }
}
