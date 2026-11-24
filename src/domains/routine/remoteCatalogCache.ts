import { db } from '../../db/schema'
import { publishedCatalogSchema, type PublishedCatalog } from '../../shared/validation/remoteCatalog'

export async function readRemoteCatalog(): Promise<PublishedCatalog | null> {
  const record = await db.localMetadata.get('globalCatalog')
  if (!record) return null
  if (record.id !== 'globalCatalog') return null
  const parsed = publishedCatalogSchema.safeParse(record.value)
  return parsed.success ? parsed.data : null
}

export async function applyRemoteCatalog(
  raw: unknown,
  ensureImage: (image: PublishedCatalog['exercises'][number]['image']) => Promise<boolean>,
): Promise<boolean> {
  const snapshot = publishedCatalogSchema.parse(raw)
  const current = await readRemoteCatalog()
  if (current && current.version >= snapshot.version) return false
  for (const exercise of snapshot.exercises) {
    if (!(await ensureImage({ ...exercise.image }))) throw new Error('No se pudo guardar una imagen del catálogo')
  }
  return db.transaction('rw', db.localMetadata, async () => {
    const latest = await readRemoteCatalog()
    if (latest && latest.version >= snapshot.version) return false
    await db.localMetadata.put({ id: 'globalCatalog', value: snapshot })
    return true
  })
}
