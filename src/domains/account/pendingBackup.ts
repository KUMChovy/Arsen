import { z } from 'zod'
import type { ContractBackup } from '../../db/contractBackup'
import { backupManifestSchema } from '../../shared/validation/backupManifest'

const uuid = z.string().uuid()
const encoder = new TextEncoder()

async function hash(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function base64(bytes: Uint8Array): string {
  let text = ''
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(text)
}

export async function encodePendingBackup(snapshot: ContractBackup, options: {
  backupId: string; deviceId: string; baseBackupId: string | null; healthConsent: boolean; maxBytes: number
}): Promise<Uint8Array> {
  const settings = { ...options }
  const { manifest: manifestText, manifestSha256, revision } = snapshot
  if (!uuid.safeParse(settings.backupId).success || !uuid.safeParse(settings.deviceId).success || (settings.baseBackupId !== null && !uuid.safeParse(settings.baseBackupId).success) || typeof settings.healthConsent !== 'boolean' || !Number.isSafeInteger(settings.maxBytes) || settings.maxBytes <= 0 || !Number.isSafeInteger(revision) || revision < 0) throw new Error('Metadatos de respaldo inválidos')
  const manifestBytes = encoder.encode(manifestText)
  if (manifestBytes.length > Math.min(settings.maxBytes, 4 * 1024 * 1024) || snapshot.binaries.length > 5000) throw new Error('Respaldo demasiado grande')
  let total = manifestBytes.length
  const copiedBinaries = snapshot.binaries.map((binary) => {
    if (typeof binary.id !== 'string' || !binary.id || binary.id.length > 256 || !(binary.bytes instanceof Uint8Array) || binary.bytes.length === 0) throw new Error('Componente de respaldo inválido')
    total += binary.bytes.length
    if (!Number.isSafeInteger(total) || total > settings.maxBytes) throw new Error('Respaldo demasiado grande')
    return { id: binary.id, bytes: Uint8Array.from(binary.bytes) }
  })
  if (!/^[a-f0-9]{64}$/.test(manifestSha256) || await hash(manifestBytes) !== manifestSha256) throw new Error('Manifiesto de respaldo inválido')
  let manifest: z.infer<typeof backupManifestSchema>
  try { manifest = backupManifestSchema.parse(JSON.parse(manifestText)) } catch { throw new Error('Manifiesto de respaldo inválido') }
  if (manifest.assets.length > 5000 || (manifest.health.length > 0 && !settings.healthConsent)) throw new Error('El respaldo requiere consentimiento o excede el límite')
  const settingsRows = manifest.tables.settings
  const sessions = manifest.tables.workoutSessions
  if (!Array.isArray(settingsRows) || settingsRows.length !== 1 || !Array.isArray(sessions)) throw new Error('Manifiesto de respaldo incompleto')
  const deviceSettings = settingsRows[0]
  if (typeof deviceSettings !== 'object' || deviceSettings === null || !('storagePersisted' in deviceSettings) || deviceSettings.storagePersisted !== null || ['lastContractBackupSha256', 'notificationPermission', 'healthIntegrationEnabled', 'healthIntegrationFirstConnectedAt', 'lastDeloadNotificationDate'].some((key) => key in deviceSettings)) throw new Error('El respaldo contiene configuración del dispositivo')
  if (sessions.some((session) => typeof session !== 'object' || session === null || 'health' in session || 'healthHistory' in session)) throw new Error('El respaldo contiene datos de salud fuera del formato autorizado')
  const assets = new Map(manifest.assets.map((item) => [item.id, item.sha256]))
  if (assets.size !== manifest.assets.length || copiedBinaries.length !== assets.size) throw new Error('Componentes de respaldo inválidos')
  let sizeBytes = manifestBytes.length
  const binaries: Array<{ id: string; base64: string }> = []
  for (const binary of copiedBinaries.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) {
    if (!binary.id || binary.id.length > 256 || !(binary.bytes instanceof Uint8Array) || binary.bytes.length === 0 || !assets.has(binary.id)) throw new Error('Componente de respaldo inválido')
    sizeBytes += binary.bytes.length
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes > settings.maxBytes || await hash(binary.bytes) !== assets.get(binary.id)) throw new Error('Componente de respaldo inválido')
    assets.delete(binary.id)
    binaries.push({ id: binary.id, base64: base64(binary.bytes) })
  }
  const result = encoder.encode(JSON.stringify({ version: 1, backupId: settings.backupId, deviceId: settings.deviceId, baseBackupId: settings.baseBackupId, revision, manifest: manifestText, manifestSha256, includesHealth: manifest.health.length > 0, healthConsent: settings.healthConsent, sizeBytes, binaries }))
  if (result.length > settings.maxBytes) throw new Error('El respaldo excede el límite de almacenamiento')
  return result
}
