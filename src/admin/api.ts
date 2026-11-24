import { z } from 'zod'
import { catalogImageSchema } from '../shared/validation/remoteCatalog'
import { matchesImageSignature } from '../shared/utils/imageSignature'

const count = z.number().int().nonnegative().safe()
const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/)
const userId = z.string().regex(/^user_[A-Za-z0-9]{1,123}$/)
const overviewSchema = z.object({ accounts: count, devices: count, confirmedBackups: count, publishedExercises: count }).strict()
const accountSchema = z.object({ userId, role: z.enum(['user', 'admin']), createdAt: z.string().datetime(), deviceCount: count, backupCount: count, lastBackupAt: z.string().datetime().nullable() }).strict()
const backupSchema = z.object({ id: z.string().uuid(), deviceId: z.string().uuid(), localRevision: count, contractVersion: count.positive(), sizeBytes: count.positive(), includesHealth: z.boolean(), confirmedAt: z.string().datetime() }).strict()
const draftSchema = z.object({ id, draft: z.record(z.unknown()), published: z.record(z.unknown()).nullable(), archived: z.boolean(), updated_at: z.string() }).strict()
const draftInput = z.object({ id, name: z.string().trim().min(1).max(200), mainMuscle: z.enum(['Pecho', 'Espalda', 'Hombros', 'Brazos', 'Abdomen', 'Piernas']).optional(), canonicalName: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(200).optional(), aliases: z.array(z.string().trim().min(1).max(200)).max(100).optional(), technicalNotes: z.string().max(10000).optional(), image: z.unknown().optional() }).strict()
export type AdminDraft = z.infer<typeof draftInput>
export function parseAdminDraft(value: unknown): AdminDraft | null {
  const result = draftInput.safeParse(value)
  return result.success ? result.data : null
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.body) throw new Error('Respuesta administrativa inválida')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > 2 * 1024 * 1024) { await reader.cancel(); throw new Error('Respuesta administrativa demasiado grande') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) } catch { throw new Error('Respuesta administrativa inválida') }
}

function requestSignal(timeoutMs: number, external?: AbortSignal) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  const timer = setTimeout(abort, timeoutMs)
  if (external?.aborted) abort()
  else external?.addEventListener('abort', abort, { once: true })
  return { signal: controller.signal, close: () => { clearTimeout(timer); external?.removeEventListener('abort', abort) } }
}

export function createAdminApi(origin: string, getToken: () => Promise<string | null>, fetcher: typeof fetch = fetch) {
  const base = new URL(origin)
  if (base.protocol !== 'https:' || base.origin !== origin || base.username || base.password) throw new Error('Origen de administración inválido')

  async function request<T>(path: string, schema: z.ZodType<T>, body?: unknown, external?: AbortSignal): Promise<T> {
    if (external?.aborted) throw new Error('Operación cancelada')
    const token = await getToken()
    if (external?.aborted) throw new Error('Operación cancelada')
    if (!token || token.length > 16384 || !/^[A-Za-z0-9._~-]+$/.test(token)) throw new Error('Inicia sesión para continuar')
    const headers = new Headers({ authorization: `Bearer ${token}` })
    if (body !== undefined) headers.set('content-type', 'application/json')
    const timeout = requestSignal(15_000, external)
    try {
      let response: Response
      try { response = await fetcher(`${base.origin}${path}`, { method: body === undefined ? 'GET' : 'POST', headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'error', credentials: 'omit', cache: 'no-store', signal: timeout.signal }) }
      catch { throw new Error('No se pudo conectar con administración') }
      if (timeout.signal.aborted) { await response.body?.cancel(); throw new Error('Operación cancelada') }
      if (!response.ok) {
        await response.body?.cancel()
        if (response.status === 401) throw new Error('Inicia sesión para continuar')
        if (response.status === 403) throw new Error('No tienes permiso para esta operación')
        if (response.status === 409) throw new Error('Los datos cambiaron. Actualiza e inténtalo de nuevo')
        if (response.status === 422) throw new Error('Completa el ejercicio y utiliza una imagen verificada')
        throw new Error('No se pudo completar la operación')
      }
      const parsed = schema.safeParse(await readJson(response))
      if (timeout.signal.aborted) throw new Error('Operación cancelada')
      if (!parsed.success) throw new Error('Respuesta administrativa inválida')
      return parsed.data
    } finally { timeout.close() }
  }

  return {
    overview: () => request('/api/v1/admin/overview', overviewSchema),
    accounts: (cursor?: string) => request(`/api/v1/admin/accounts${cursor ? `?cursor=${encodeURIComponent(userId.parse(cursor))}` : ''}`, z.object({ accounts: z.array(accountSchema).max(50), nextCursor: userId.nullable() }).strict()),
    backups: async (owner: string) => request(`/api/v1/admin/accounts/${encodeURIComponent(userId.parse(owner))}/backups`, z.object({ backups: z.array(backupSchema).max(5) }).strict()),
    drafts: (cursor?: string) => request(`/api/v1/admin/catalog/drafts${cursor ? `?cursor=${encodeURIComponent(id.parse(cursor))}` : ''}`, z.object({ items: z.array(draftSchema).max(100), nextCursor: id.nullable() }).strict()),
    saveDraft: (draft: AdminDraft, expected: AdminDraft | null) => request('/api/v1/admin/catalog/drafts', z.object({}).strict(), { draft: draftInput.parse(draft), expected: expected === null ? null : draftInput.parse(expected) }),
    publish: (itemId: string) => request('/api/v1/admin/catalog/publish', z.object({ version: count.positive() }).strict(), { id: id.parse(itemId) }),
    archive: (itemId: string) => request('/api/v1/admin/catalog/archive', z.object({ version: count.positive() }).strict(), { id: id.parse(itemId) }),
    invite: (invitationId: string, email: string) => request('/api/v1/admin/invitations', z.object({ id: z.string().uuid() }).strict(), { id: z.string().uuid().parse(invitationId), email: z.string().email().max(254).parse(email.trim()) }),
    uploadImage: async (file: Blob, signal?: AbortSignal) => {
      if (signal?.aborted) throw new Error('Operación cancelada')
      const mime = z.enum(['image/png', 'image/jpeg', 'image/webp']).safeParse(file.type)
      if (!mime.success || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > 10 * 1024 * 1024) throw new Error('Selecciona una imagen PNG, JPEG o WebP de hasta 10 MB')
      const bytes = await file.arrayBuffer()
      if (bytes.byteLength !== file.size) throw new Error('No se pudo leer la imagen')
      if (!matchesImageSignature(mime.data, new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 12)))) throw new Error('El archivo no coincide con el tipo de imagen')
      const digest = await crypto.subtle.digest('SHA-256', bytes)
      if (signal?.aborted) throw new Error('Operación cancelada')
      const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
      const signed = await request('/api/v1/admin/catalog/image-upload', z.object({ uploadUrl: z.string().url(), imageUrl: z.string().url() }).strict(), { mimeType: mime.data, sizeBytes: file.size }, signal)
      if (signal?.aborted) throw new Error('Operación cancelada')
      const upload = new URL(signed.uploadUrl)
      const image = new URL(signed.imageUrl)
      const path = image.pathname.slice(1)
      const extension = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' }[mime.data]
      if (image.protocol !== 'https:' || image.username || image.password || image.search || image.hash || !/^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(image.hostname) || !/^catalog\/images\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg|webp)$/.test(path) || !path.endsWith(extension) || upload.origin !== 'https://vercel.com' || upload.username || upload.password || !['/api/blob', '/api/blob/'].includes(upload.pathname) || upload.searchParams.get('pathname') !== path || !upload.searchParams.get('vercel-blob-delegation') || !upload.searchParams.get('vercel-blob-signature')) throw new Error('Autorización de imagen inválida')
      const timeout = requestSignal(60_000, signal)
      try {
        let response: Response
        try { response = await fetcher(upload.href, { method: 'PUT', headers: { 'content-type': mime.data }, body: file, redirect: 'error', credentials: 'omit', cache: 'no-store', signal: timeout.signal }) }
        catch { throw new Error('No se pudo cargar la imagen') }
        await response.body?.cancel()
        if (timeout.signal.aborted || !response.ok) throw new Error('No se pudo cargar la imagen')
      } finally { timeout.close() }
      return catalogImageSchema.parse({ url: image.href, sha256, sizeBytes: file.size, mimeType: mime.data })
    },
  }
}
