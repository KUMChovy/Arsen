import { createHash } from 'node:crypto'
import { DATA_CONTRACT_VERSION } from '../../src/shared/validation/dataContract'
import { validateRemoteManifest } from './validateManifest'

type Metadata = { manifestSha256: string; sizeBytes: number; contractVersion: number; includesHealth: boolean }
// The adapter must enforce maxBytes while streaming, and read immutable, owner-scoped object versions.
type ReadObject = (kind: 'manifest' | 'asset', id: string | undefined, maxBytes: number) => Promise<Uint8Array | null>

export async function verifyArchive(metadata: Metadata, read: ReadObject): Promise<boolean> {
  if (!Number.isSafeInteger(metadata.sizeBytes) || metadata.sizeBytes <= 0 || metadata.contractVersion !== DATA_CONTRACT_VERSION) return false
  const manifest = await read('manifest', undefined, Math.min(metadata.sizeBytes, 4 * 1024 * 1024))
  if (!manifest || manifest.byteLength > metadata.sizeBytes) return false
  let parsed: ReturnType<typeof validateRemoteManifest>
  try { parsed = validateRemoteManifest(manifest, metadata.manifestSha256, metadata.includesHealth) } catch { return false }
  if (parsed.healthIncluded !== metadata.includesHealth) return false
  let remaining = metadata.sizeBytes - manifest.byteLength
  for (const asset of parsed.assets) {
    const bytes = await read('asset', asset.id, remaining)
    if (!bytes || bytes.byteLength === 0 || bytes.byteLength > remaining || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) return false
    remaining -= bytes.byteLength
  }
  return remaining === 0
}
