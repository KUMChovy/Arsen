import { createHash, timingSafeEqual } from 'node:crypto'
import { backupManifestSchema } from '../../src/shared/validation/backupManifest'
import { datasetSchema } from '../../src/shared/validation/dataset'
import { CURRENT_SCHEMA_VERSION } from '../../src/db/schemaVersion'

export function validateRemoteManifest(bytes: Uint8Array, expectedSha256: string, healthConsent: boolean): {
  assets: Array<{ id: string; sha256: string; mimeType: string }>
  healthIncluded: boolean
} {
  if (bytes.byteLength > 4 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(expectedSha256)) throw new Error('Manifiesto inválido')
  const expected = Buffer.from(expectedSha256, 'hex')
  const actual = createHash('sha256').update(bytes).digest()
  if (!timingSafeEqual(actual, expected)) throw new Error('La integridad del manifiesto no coincide')
  let raw: unknown
  try { raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) } catch { throw new Error('Manifiesto inválido') }
  const manifest = backupManifestSchema.parse(raw)
  if (manifest.assets.length > 5000 || (manifest.health.length > 0 && !healthConsent)) throw new Error('El manifiesto no está autorizado')
  const { tables } = manifest
  if (!Array.isArray(tables.settings) || tables.settings.length !== 1 || !Array.isArray(tables.exerciseAssets) || !Array.isArray(tables.workoutSessions)) throw new Error('Manifiesto incompleto')
  const settings = tables.settings[0]
  if (typeof settings !== 'object' || settings === null || !('schemaVersion' in settings) || settings.schemaVersion !== CURRENT_SCHEMA_VERSION || !('storagePersisted' in settings) || settings.storagePersisted !== null || ['lastContractBackupSha256', 'notificationPermission', 'healthIntegrationEnabled', 'healthIntegrationFirstConnectedAt', 'lastDeloadNotificationDate'].some((key) => key in settings)) throw new Error('Configuración de dispositivo no permitida')
  const hashes = new Map(manifest.assets.map((asset) => [asset.id, asset.sha256]))
  if (hashes.size !== manifest.assets.length || manifest.assets.some((asset) => asset.id.length > 256)) throw new Error('Componentes de imagen inválidos')
  const assets: Array<{ id: string; sha256: string; mimeType: string }> = []
  const imageRows = tables.exerciseAssets.map((rawAsset) => {
    if (typeof rawAsset !== 'object' || rawAsset === null || 'dataUrl' in rawAsset || !('id' in rawAsset) || typeof rawAsset.id !== 'string' || !('mimeType' in rawAsset) || typeof rawAsset.mimeType !== 'string') throw new Error('Metadatos de imagen inválidos')
    const sha256 = hashes.get(rawAsset.id)
    if (!sha256) throw new Error('Falta un componente de imagen')
    hashes.delete(rawAsset.id)
    assets.push({ id: rawAsset.id, sha256, mimeType: rawAsset.mimeType })
    return { ...rawAsset, dataUrl: `data:${rawAsset.mimeType};base64,AQ==` }
  })
  if (hashes.size) throw new Error('Hay componentes de imagen sin referencia')
  const health = new Map(manifest.health.map((entry) => [entry.sessionId, entry]))
  if (health.size !== manifest.health.length) throw new Error('Resúmenes de salud duplicados')
  const sessions = tables.workoutSessions.map((rawSession) => {
    if (typeof rawSession !== 'object' || rawSession === null || !('id' in rawSession) || typeof rawSession.id !== 'string' || 'health' in rawSession || 'healthHistory' in rawSession) throw new Error('Sesión inválida')
    const entry = health.get(rawSession.id)
    if (entry) health.delete(rawSession.id)
    return entry ? { ...rawSession, ...(entry.summary ? { health: entry.summary } : {}), ...(entry.history ? { healthHistory: entry.history } : {}) } : rawSession
  })
  if (health.size || !datasetSchema.safeParse({ ...tables, exerciseAssets: imageRows, workoutSessions: sessions }).success) throw new Error('Los datos no cumplen el contrato')
  return { assets, healthIncluded: manifest.health.length > 0 }
}
