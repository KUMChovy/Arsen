import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/schema'
import { importFullBackup } from './services'
import type { AppSettings } from './types'
import type { Routine } from '../routine/types'

const now = '2026-07-20T00:00:00.000Z'

describe('settings backup imports', () => {
  beforeEach(async () => {
    await resetDb()
  })

  afterEach(async () => {
    await resetDb()
  })

  it('replaces local backup tables when mode is replace', async () => {
    await db.settings.put(settings('local-routine', 'lb'))
    await db.routines.put(routine('local-routine', 'Local'))

    await importFullBackup(
      backupFile({
        settings: [settings('remote-routine', 'kg')],
        routines: [routine('remote-routine', 'Remote')],
      }),
      'replace',
    )

    await expect(db.routines.toArray()).resolves.toEqual([routine('remote-routine', 'Remote')])
    await expect(db.settings.get('app')).resolves.toMatchObject({
      activeRoutineId: 'remote-routine',
      preferredUnit: 'kg',
    })
  })

  it('merges backup tables without replacing existing app settings', async () => {
    await db.settings.put(settings('local-routine', 'lb'))
    await db.routines.put(routine('local-routine', 'Local'))

    await importFullBackup(
      backupFile({
        settings: [settings('remote-routine', 'kg')],
        routines: [routine('remote-routine', 'Remote')],
      }),
      'merge',
    )

    await expect(db.routines.orderBy('id').toArray()).resolves.toEqual([
      routine('local-routine', 'Local'),
      routine('remote-routine', 'Remote'),
    ])
    await expect(db.settings.get('app')).resolves.toMatchObject({
      activeRoutineId: 'local-routine',
      preferredUnit: 'lb',
    })
  })
})

async function resetDb() {
  db.close()
  await db.delete()
  await db.open()
}

function backupFile(tables: {
  routines?: Routine[]
  settings?: AppSettings[]
}) {
  return new File(
    [
      JSON.stringify({
        exportedAt: now,
        schemaVersion: 1,
        tables,
      }),
    ],
    'backup.json',
    { type: 'application/json' },
  )
}

function routine(id: string, name: string): Routine {
  return {
    createdAt: now,
    id,
    isActive: id.includes('local'),
    name,
    updatedAt: now,
  }
}

function settings(activeRoutineId: string, preferredUnit: 'kg' | 'lb'): AppSettings {
  return {
    activeRoutineId,
    createdAt: now,
    deloadNotifications: true,
    id: 'app',
    preferredUnit,
    schemaVersion: 1,
    storagePersisted: null,
    updatedAt: now,
  }
}
