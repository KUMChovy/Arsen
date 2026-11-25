import { z } from 'zod'
import type { AdminDraft } from './api'
import { matchesImageSignature } from '../shared/utils/imageSignature'
import { catalogImageSchema } from '../shared/validation/remoteCatalog'

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(128)
const itemSchema = z.object({
  id: slug, name: z.string().trim().min(1).max(200), canonicalName: slug,
  mainMuscle: z.enum(['Pecho', 'Espalda', 'Hombros', 'Brazos', 'Abdomen', 'Piernas']),
  aliases: z.array(z.string().trim().min(1).max(200)).max(100), technicalNotes: z.string().trim().min(1).max(10000),
  image: z.object({ localPath: z.string().regex(/^src\/assets\/ejercicios\/[a-z0-9-]+--(?:pecho|espalda|hombros|brazos|abdomen|piernas)\.png$/), sha256: z.string().regex(/^[a-f0-9]{64}$/), sizeBytes: z.number().int().positive().max(10 * 1024 * 1024), mimeType: z.literal('image/png') }).strict(),
}).strict()
type SeedApi = {
  drafts: (cursor?: string) => Promise<{ items: Array<{ id: string; draft?: unknown; published?: unknown; archived?: boolean }>; nextCursor: string | null }>
  uploadImage: (file: Blob, signal?: AbortSignal) => Promise<AdminDraft['image']>
  saveDraft: (draft: AdminDraft, expected: AdminDraft | null) => Promise<unknown>
  publish: (id: string) => Promise<unknown>
}

export async function seedCatalog(api: SeedApi, raw: unknown, files: File[], signal?: AbortSignal, progress?: (done: number, total: number) => void) {
  const items = z.array(itemSchema).min(1).max(100).parse(raw)
  if (new Set(items.map((item) => item.id)).size !== items.length) throw new Error('El inventario contiene identificadores duplicados')
  if (files.length > 100) throw new Error('Demasiadas imágenes')
  const names = new Map<string, File>()
  for (const file of files) {
    if (names.has(file.name)) throw new Error('Hay nombres de archivo duplicados')
    names.set(file.name, file)
  }
  for (const item of items) {
    if (signal?.aborted) throw new Error('Operación cancelada')
    const file = names.get(item.image.localPath.split('/').at(-1)!)
    if (!file || file.size !== item.image.sizeBytes || file.type !== 'image/png') throw new Error(`Falta una imagen válida para ${item.id}`)
    const bytes = await file.arrayBuffer()
    if (!matchesImageSignature('image/png', new Uint8Array(bytes, 0, Math.min(12, bytes.byteLength)))) throw new Error(`Imagen inválida para ${item.id}`)
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    if (hash !== item.image.sha256) throw new Error(`La imagen de ${item.id} no coincide con el inventario`)
  }
  const existing = new Map<string, { draft?: unknown; published?: unknown; archived?: boolean }>()
  const cursors = new Set<string>()
  let cursor: string | undefined
  do {
    if (signal?.aborted) throw new Error('Operación cancelada')
    const page = await api.drafts(cursor)
    if (signal?.aborted) throw new Error('Operación cancelada')
    for (const item of page.items) existing.set(item.id, item)
    if (page.nextCursor && (cursors.has(page.nextCursor) || existing.size > 10000)) throw new Error('Paginación inválida')
    if (page.nextCursor) cursors.add(page.nextCursor)
    cursor = page.nextCursor ?? undefined
  } while (cursor)
  let published = 0
  let skipped = 0
  for (const item of items) {
    if (signal?.aborted) throw new Error('Operación cancelada')
    const current = existing.get(item.id)
    if (current) {
      const draft = z.object({ id: slug, name: z.string(), canonicalName: z.string(), mainMuscle: z.string(), aliases: z.array(z.string()), technicalNotes: z.string(), image: catalogImageSchema }).strict().safeParse(current.draft)
      const same = draft.success && draft.data.id === item.id && draft.data.name === item.name && draft.data.canonicalName === item.canonicalName && draft.data.mainMuscle === item.mainMuscle && JSON.stringify(draft.data.aliases) === JSON.stringify(item.aliases) && draft.data.technicalNotes === item.technicalNotes && draft.data.image.sha256 === item.image.sha256 && draft.data.image.sizeBytes === item.image.sizeBytes && draft.data.image.mimeType === item.image.mimeType
      if (same && current.published === null && current.archived === false) { await api.publish(item.id); published++ } else skipped++
      progress?.(published + skipped, items.length)
      continue
    }
    const file = names.get(item.image.localPath.split('/').at(-1)!)!
    const image = await api.uploadImage(file, signal)
    if (signal?.aborted) throw new Error('Operación cancelada')
    const { image: _localImage, ...exercise } = item
    await api.saveDraft({ ...exercise, image }, null)
    if (signal?.aborted) throw new Error('Operación cancelada')
    await api.publish(item.id)
    published++
    progress?.(published + skipped, items.length)
  }
  return { published, skipped }
}
