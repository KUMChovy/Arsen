import { db } from './schema'

type AssetReference = { entity: 'exerciseCatalog' | 'routineExercises' | 'workoutSessions' | 'exerciseLogs'; id: string }
export type AssetInventoryItem = {
  id: string
  name: string | null
  mimeType: string | null
  missing: boolean
  sizeBytes: number | null
  references: AssetReference[]
}

function base64Size(dataUrl: string): number | null {
  const match = /^data:image\/[^;,]+;base64,((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/i.exec(dataUrl)
  if (!match) return null
  const encoded = match[1]!
  return encoded.length / 4 * 3 - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0)
}

/** Returns metadata only; an unused or missing resource is never deleted. */
export async function inspectExerciseAssets(): Promise<AssetInventoryItem[]> {
  return db.transaction('r', [db.exerciseAssets, db.exerciseCatalog, db.routineExercises, db.workoutSessions, db.exerciseLogs], async () => {
    const [assets, catalog, exercises, sessions, logs] = await Promise.all([
      db.exerciseAssets.toArray(), db.exerciseCatalog.toArray(), db.routineExercises.toArray(), db.workoutSessions.toArray(), db.exerciseLogs.toArray(),
    ])
    const items = new Map<string, AssetInventoryItem>(assets.map((asset) => [asset.id, {
      id: asset.id, name: asset.name, mimeType: asset.mimeType, missing: false, sizeBytes: base64Size(asset.dataUrl), references: [],
    }]))
    const reference = (assetId: string | null | undefined, entity: AssetReference['entity'], id: string) => {
      if (!assetId) return
      const item = items.get(assetId) ?? { id: assetId, name: null, mimeType: null, missing: true, sizeBytes: null, references: [] }
      if (!item.references.some((ref) => ref.entity === entity && ref.id === id)) item.references.push({ entity, id })
      items.set(assetId, item)
    }
    for (const item of catalog) reference(item.customAssetId, 'exerciseCatalog', item.id)
    for (const item of exercises) reference(item.customAssetId, 'routineExercises', item.id)
    for (const session of sessions) for (const exercise of session.sessionExercises ?? []) reference(exercise.customAssetId, 'workoutSessions', session.id)
    for (const log of logs) reference(log.snapshot?.customAssetId, 'exerciseLogs', log.id)
    return [...items.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  })
}
