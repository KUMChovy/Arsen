import { z } from 'zod'
import { getLocalRevision, restoreRemoteContractBackup, type ContractBackup } from '../../db/contractBackup'
import { isNativeAccount, nativeBackup } from './native'

const maxBytes = 16 * 1024 * 1024
export const summarySchema = z.object({
  id: z.string().uuid(), deviceId: z.string().uuid(), localRevision: z.number().int().safe().nonnegative(),
  contractVersion: z.literal(1), sizeBytes: z.number().int().positive().max(maxBytes), includesHealth: z.boolean(), confirmedAt: z.string().datetime(),
})
const restoreContext = z.object({ status: z.literal('READY'), owner: z.string().regex(/^user_[A-Za-z0-9]{1,123}$/), baseBackupId: z.string().uuid(), summary: summarySchema }).refine((value) => value.baseBackupId === value.summary.id)
const archiveSchema = z.object({ manifest: z.string().min(1), manifestSha256: z.string().regex(/^[a-f0-9]{64}$/), binaries: z.array(z.object({ id: z.string().min(1).max(256), base64: z.string().min(1) })).max(5000) })

export type RestorePreview = { owner: string; summary: z.infer<typeof summarySchema>; localRevision: number; backup: ContractBackup; baseBackupId?: string }

export async function listRestoreVersions() {
  if (!isNativeAccount()) throw new Error('La restauración está disponible en Android')
  return z.object({ owner: z.string().regex(/^user_[A-Za-z0-9]{1,123}$/), backups: z.array(summarySchema).max(5) }).parse(await nativeBackup.listVersions())
}

async function requireNoPending() {
  const pending = await nativeBackup.getPending()
  if (pending.pending !== false) throw new Error('Hay un respaldo pendiente; espera a que termine antes de restaurar')
}

export async function prepareRestorePreview(selectedId?: string): Promise<RestorePreview> {
  if (!isNativeAccount()) throw new Error('La restauración está disponible en Android')
  await requireNoPending()
  const localRevision = await getLocalRevision()
  const context = restoreContext.parse(await nativeBackup.prepareContext())
  let summary = context.summary
  if (selectedId && selectedId !== context.baseBackupId) {
    const versions = await listRestoreVersions()
    if (versions.owner !== context.owner) throw new Error('La cuenta cambió')
    const selected = versions.backups.find((item) => item.id === selectedId)
    if (!selected) throw new Error('La copia ya no está disponible')
    summary = selected
  }
  const archive = archiveSchema.parse(await nativeBackup.download({ owner: context.owner, backupId: summary.id }))
  let size = new TextEncoder().encode(archive.manifest).length
  const ids = new Set<string>()
  const binaries = archive.binaries.map(({ id, base64 }) => {
    if (ids.has(id) || base64.length > Math.ceil(maxBytes / 3) * 4) throw new Error('Componentes inválidos')
    ids.add(id)
    const decoded = atob(base64)
    if (btoa(decoded) !== base64 || !decoded.length) throw new Error('Componente inválido')
    size += decoded.length
    if (size > maxBytes) throw new Error('Respaldo demasiado grande')
    return { id, bytes: Uint8Array.from(decoded, (value) => value.charCodeAt(0)) }
  })
  if (size !== summary.sizeBytes) throw new Error('El tamaño del respaldo no coincide')
  return { owner: context.owner, summary, localRevision, baseBackupId: context.baseBackupId, backup: { manifest: archive.manifest, manifestSha256: archive.manifestSha256, revision: summary.localRevision, binaries } }
}

export async function applyRestorePreview(preview: RestorePreview): Promise<void> {
  await requireNoPending()
  const current = restoreContext.parse(await nativeBackup.prepareContext())
  if (current.owner !== preview.owner || current.baseBackupId !== (preview.baseBackupId ?? preview.summary.id)) throw new Error('La cuenta o el respaldo cambiaron; vuelve a preparar la vista previa')
  if (preview.summary.id !== current.baseBackupId) {
    const versions = await listRestoreVersions()
    if (versions.owner !== preview.owner || !versions.backups.some((item) => item.id === preview.summary.id && JSON.stringify(item) === JSON.stringify(preview.summary))) throw new Error('La copia ya no está disponible')
  }
  await restoreRemoteContractBackup(preview.backup, preview.localRevision)
}
