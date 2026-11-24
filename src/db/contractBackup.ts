import { CURRENT_SCHEMA_VERSION, dataTables, db } from './schema'
import { DATA_CONTRACT_VERSION, imageAssetInputSchema } from '../shared/validation/dataContract'
import { datasetSchema, type ValidatedDataset } from '../shared/validation/dataset'
import { backupManifestSchema } from '../shared/validation/backupManifest'

export type ContractBackup = {
  manifest: string
  manifestSha256: string
  binaries: Array<{ id: string; bytes: Uint8Array }>
  revision: number
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (value === undefined || typeof value === 'number' && !Number.isFinite(value)) throw new Error('El conjunto contiene valores no serializables')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes)
  const hash = await crypto.subtle.digest('SHA-256', copy.buffer)
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function decodeBase64(encoded: string): Uint8Array {
  const decoded = atob(encoded)
  const bytes = new Uint8Array(decoded.length)
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i)
  return bytes
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(binary)
}

async function readDataset() {
  return db.transaction('r', db.tables, async () => ({ data: {
    settings: await db.settings.toArray(), deloadCycles: await db.deloadCycles.toArray(), routines: await db.routines.toArray(),
    routineDays: await db.routineDays.toArray(), routineExercises: await db.routineExercises.toArray(), exerciseCatalog: await db.exerciseCatalog.toArray(),
    exerciseAssets: await db.exerciseAssets.toArray(), weeklyVolumeTargets: await db.weeklyVolumeTargets.toArray(), workoutSessions: await db.workoutSessions.toArray(),
    exerciseLogs: await db.exerciseLogs.toArray(), setLogs: await db.setLogs.toArray(), dropSetLogs: await db.dropSetLogs.toArray(), skipLogs: await db.skipLogs.toArray(),
  }, revision: await getLocalRevision() }))
}

export async function createContractBackup(options?: { includeHealth?: boolean }): Promise<ContractBackup> {
  const snapshot = await readDataset()
  return { ...await buildContractBackup(snapshot.data, options?.includeHealth !== false), revision: snapshot.revision }
}

export async function createRemoteContractBackup(options?: { healthConsent?: boolean }): Promise<ContractBackup> {
  const snapshot = await readDataset()
  const settings = snapshot.data.settings.map(({
    notificationPermission: _notificationPermission,
    healthIntegrationEnabled: _healthIntegrationEnabled,
    healthIntegrationFirstConnectedAt: _healthIntegrationFirstConnectedAt,
    lastDeloadNotificationDate: _lastDeloadNotificationDate,
    storagePersisted: _storagePersisted,
    ...portable
  }) => ({ ...portable, storagePersisted: null }))
  return { ...await buildContractBackup({ ...snapshot.data, settings }, options?.healthConsent === true), revision: snapshot.revision }
}

export async function getLocalRevision(): Promise<number> {
  return db.transaction('r', db.tables, async () => {
    const record = await db.localMetadata.get('revision')
    if (!record) {
      const counts = await Promise.all(dataTables().map((table) => table.count()))
      if (counts.some((count) => count > 0)) throw new Error('Falta la revisión local de los datos')
      return 0
    }
    if (record.id !== 'revision' || !Number.isSafeInteger(record.value) || record.value < 0) throw new Error('La revisión local no es válida')
    return record.value
  })
}

async function buildContractBackup(raw: unknown, includeHealth = true): Promise<Omit<ContractBackup, 'revision'>> {
  const validation = datasetSchema.safeParse(raw)
  if (!validation.success) throw new Error(`Los datos no cumplen el contrato: ${validation.error.issues[0]?.message ?? 'datos inválidos'}`)
  const data = validation.data
  if (data.settings[0]?.schemaVersion !== CURRENT_SCHEMA_VERSION) throw new Error('La versión registrada requiere una transición explícita')
  const health = includeHealth ? data.workoutSessions.flatMap((session) => session.health || session.healthHistory?.length ? [{ sessionId: session.id, ...(session.health ? { summary: session.health } : {}), ...(session.healthHistory?.length ? { history: session.healthHistory } : {}) }] : []) : []
  const binaries: ContractBackup['binaries'] = []
  const assetHashes: Array<{ id: string; sha256: string }> = []
  const assetMetadata = []
  for (const asset of data.exerciseAssets) {
    if (!imageAssetInputSchema.safeParse(asset).success) throw new Error(`La imagen ${asset.id} no puede convertirse sin pérdida`)
    const encoded = asset.dataUrl.slice(asset.dataUrl.indexOf(',') + 1)
    const bytes = decodeBase64(encoded)
    if (encodeBase64(bytes) !== encoded) throw new Error(`La imagen ${asset.id} no puede convertirse sin pérdida`)
    binaries.push({ id: asset.id, bytes })
    assetHashes.push({ id: asset.id, sha256: await sha256(bytes) })
    const { dataUrl: _dataUrl, ...metadata } = asset
    assetMetadata.push(metadata)
  }
  const tables = {
    ...data,
    settings: data.settings.map(({ lastContractBackupSha256: _lastBackup, ...settings }) => settings),
    exerciseAssets: assetMetadata,
    workoutSessions: data.workoutSessions.map(({ health: _health, healthHistory: _healthHistory, ...session }) => session),
  }
  const byId = <T extends { id: string }>(a: T, b: T) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  for (const rows of Object.values(tables)) rows.sort(byId)
  binaries.sort(byId)
  assetHashes.sort(byId)
  health.sort((a, b) => a.sessionId < b.sessionId ? -1 : a.sessionId > b.sessionId ? 1 : 0)
  const manifest = canonical({ version: DATA_CONTRACT_VERSION, tables, assets: assetHashes, health })
  return { manifest, manifestSha256: await sha256(new TextEncoder().encode(manifest)), binaries }
}

export async function getContractBackupStatus(): Promise<'current' | 'needed'> {
  const { data } = await readDataset()
  const saved = data.settings.find((settings) => settings.id === 'app')?.lastContractBackupSha256
  if (!saved) return 'needed'
  const backup = await buildContractBackup(data)
  return backup.manifestSha256 === saved ? 'current' : 'needed'
}

/** Call only after the corresponding backup has been saved successfully. */
export async function markContractBackupSaved(manifestSha256: string): Promise<void> {
  if (!/^[a-f0-9]{64}$/.test(manifestSha256)) throw new Error('La huella del respaldo no es válida')
  await db.transaction('rw', db.settings, async () => {
    if (!(await db.settings.update('app', { lastContractBackupSha256: manifestSha256 }))) throw new Error('Configuración no encontrada')
  })
}

export async function restoreContractBackup(backup: ContractBackup): Promise<void> {
  return restoreBackup(backup, null)
}

export async function restoreRemoteContractBackup(backup: ContractBackup, expectedLocalRevision: number): Promise<void> {
  if (!Number.isSafeInteger(expectedLocalRevision) || expectedLocalRevision < 0) throw new Error('La revisión de restauración no es válida')
  return restoreBackup(backup, expectedLocalRevision)
}

async function restoreBackup(backup: ContractBackup, expectedLocalRevision: number | null): Promise<void> {
  const manifest = backup.manifest
  const manifestSha256 = backup.manifestSha256
  const copiedBinaries = backup.binaries.map((binary) => {
    if (!(binary.bytes instanceof Uint8Array)) throw new Error('El componente de imagen no es válido')
    return { id: binary.id, bytes: new Uint8Array(binary.bytes) }
  })
  if (await sha256(new TextEncoder().encode(manifest)) !== manifestSha256) throw new Error('La integridad del respaldo no coincide')
  const parsed = backupManifestSchema.safeParse(JSON.parse(manifest))
  if (!parsed.success) throw new Error('El manifiesto del respaldo no es válido')
  const { tables, assets, health } = parsed.data
  if (!Array.isArray(tables.exerciseAssets) || !Array.isArray(tables.workoutSessions)) throw new Error('El respaldo no contiene todas las tablas')
  if (!Array.isArray(tables.settings) || tables.settings.some((setting) => typeof setting !== 'object' || setting === null || 'lastContractBackupSha256' in setting)) throw new Error('La configuración del respaldo no es válida')
  if (expectedLocalRevision !== null && tables.settings.some((setting) => typeof setting !== 'object' || setting === null || !('storagePersisted' in setting) || setting.storagePersisted !== null || ['notificationPermission', 'healthIntegrationEnabled', 'healthIntegrationFirstConnectedAt', 'lastDeloadNotificationDate'].some((key) => key in setting))) throw new Error('El respaldo contiene configuración específica de otro dispositivo')
  const binaries = new Map(copiedBinaries.map((binary) => [binary.id, binary.bytes]))
  const hashes = new Map(assets.map((asset) => [asset.id, asset.sha256]))
  if (binaries.size !== copiedBinaries.length || hashes.size !== assets.length || binaries.size !== hashes.size) throw new Error('Los componentes de imagen no son válidos')
  const imageRows = []
  for (const raw of tables.exerciseAssets) {
    if (typeof raw !== 'object' || raw === null || 'dataUrl' in raw || !('id' in raw) || typeof raw.id !== 'string' || !('mimeType' in raw) || typeof raw.mimeType !== 'string') throw new Error('Los metadatos de imagen no son válidos')
    const bytes = binaries.get(raw.id)
    const expected = hashes.get(raw.id)
    if (!(bytes instanceof Uint8Array) || !expected || await sha256(bytes) !== expected) throw new Error('La imagen del respaldo no coincide')
    const image = { ...raw, dataUrl: `data:${raw.mimeType};base64,${encodeBase64(bytes)}` }
    if (!imageAssetInputSchema.safeParse(image).success) throw new Error('Los datos de imagen no son válidos')
    imageRows.push(image)
  }
  if (imageRows.length !== binaries.size || new Set(imageRows.map((row) => row.id)).size !== imageRows.length) throw new Error('Faltan componentes de imagen')
  const healthBySession = new Map(health.map((item) => [item.sessionId, item]))
  if (healthBySession.size !== health.length) throw new Error('Hay resúmenes de salud duplicados')
  const sessionRows = tables.workoutSessions.map((raw) => {
    if (typeof raw !== 'object' || raw === null || !('id' in raw) || typeof raw.id !== 'string' || 'health' in raw || 'healthHistory' in raw) throw new Error('La sesión del respaldo no es válida')
    const item = healthBySession.get(raw.id)
    if (item) healthBySession.delete(raw.id)
    return item ? { ...raw, ...(item.summary ? { health: item.summary } : {}), ...(item.history ? { healthHistory: item.history } : {}) } : raw
  })
  if (healthBySession.size) throw new Error('Hay resúmenes de salud sin sesión')
  const result = datasetSchema.safeParse({ ...tables, exerciseAssets: imageRows, workoutSessions: sessionRows })
  if (!result.success) throw new Error(`Los datos del respaldo no cumplen el contrato: ${result.error.issues[0]?.message ?? 'datos inválidos'}`)
  if (result.data.settings[0]?.schemaVersion !== CURRENT_SCHEMA_VERSION) throw new Error('La versión del esquema del respaldo no es compatible')
  await replaceDataset(result.data, expectedLocalRevision)
}

async function replaceDataset(data: ValidatedDataset, expectedLocalRevision: number | null) {
  await db.transaction('rw', db.tables, async () => {
    if (expectedLocalRevision !== null) {
      const revision = await db.localMetadata.get('revision')
      if (!revision || revision.id !== 'revision' || revision.value !== expectedLocalRevision) throw new Error('Los datos locales cambiaron después de la vista previa')
    }
    const current = expectedLocalRevision !== null ? await db.settings.get('app') : undefined
    const settings = current ? data.settings.map((setting) => ({
      ...setting,
      storagePersisted: current.storagePersisted,
      ...(current.notificationPermission === undefined ? {} : { notificationPermission: current.notificationPermission }),
      ...(current.healthIntegrationEnabled === undefined ? {} : { healthIntegrationEnabled: current.healthIntegrationEnabled }),
      ...(current.healthIntegrationFirstConnectedAt === undefined ? {} : { healthIntegrationFirstConnectedAt: current.healthIntegrationFirstConnectedAt }),
      ...(current.lastDeloadNotificationDate === undefined ? {} : { lastDeloadNotificationDate: current.lastDeloadNotificationDate }),
    })) : data.settings
    await Promise.all(dataTables().map((table) => table.clear()))
    await Promise.all([
      db.settings.bulkAdd(settings), db.deloadCycles.bulkAdd(data.deloadCycles), db.routines.bulkAdd(data.routines),
      db.routineDays.bulkAdd(data.routineDays), db.routineExercises.bulkAdd(data.routineExercises), db.exerciseCatalog.bulkAdd(data.exerciseCatalog),
      db.exerciseAssets.bulkAdd(data.exerciseAssets), db.weeklyVolumeTargets.bulkAdd(data.weeklyVolumeTargets), db.workoutSessions.bulkAdd(data.workoutSessions),
      db.exerciseLogs.bulkAdd(data.exerciseLogs), db.setLogs.bulkAdd(data.setLogs), db.dropSetLogs.bulkAdd(data.dropSetLogs), db.skipLogs.bulkAdd(data.skipLogs),
    ])
  })
}
