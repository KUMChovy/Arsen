import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import type { createAdminApi } from './api'
import { seedCatalog } from './seedCatalog'

export function SeedImport({ api, onComplete }: { api: ReturnType<typeof createAdminApi>; onComplete: () => Promise<void> }) {
  const [inventory, setInventory] = useState<File | null>(null)
  const [images, setImages] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const operation = useRef<AbortController | null>(null)
  useEffect(() => () => operation.current?.abort(), [])
  async function start() {
    if (!inventory || busy || operation.current) return
    if (!window.confirm('Se publicarán los ejercicios iniciales que aún no existen. Los existentes se conservarán. ¿Continuar?')) return
    const controller = new AbortController()
    operation.current = controller
    setBusy(true); setError(''); setMessage('')
    try {
      if (inventory.size > 1024 * 1024) throw new Error('El inventario es demasiado grande')
      const parsed = z.object({ format: z.literal(1), exercises: z.array(z.unknown()).length(74) }).strict().parse(JSON.parse(await inventory.text()))
      const result = await seedCatalog(api, parsed.exercises, images, controller.signal, (done, total) => { if (!controller.signal.aborted) setMessage(`Procesados ${done} de ${total} ejercicios.`) })
      if (controller.signal.aborted) return
      await onComplete()
      if (!controller.signal.aborted) setMessage(`Publicados: ${result.published}. Ya existentes: ${result.skipped}.`)
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error && reason.message.startsWith('La protección del servidor rechazó la solicitud') ? 'La protección del servidor rechazó la solicitud. Espera y reintenta; los ejercicios existentes se conservarán.' : 'No se completó la carga. Comprueba el inventario, las imágenes y la conexión; puedes reintentar sin sobrescribir ejercicios existentes.')
    } finally { if (operation.current === controller) operation.current = null; if (!controller.signal.aborted) setBusy(false) }
  }
  return <section className="mb-5 space-y-3 rounded-xl border border-white/10 bg-arsen-surface p-4" aria-label="Carga inicial del catálogo"><h2 className="font-bold">Carga inicial</h2><p className="text-sm leading-6 text-arsen-muted">Selecciona el inventario preparado y las 74 imágenes originales. Se verifican antes de publicar; los ejercicios existentes se conservan.</p><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Inventario inicial<input type="file" accept="application/json,.json" disabled={busy} onChange={(event) => setInventory(event.target.files?.[0] ?? null)} className="mt-2 block min-h-11 w-full text-sm" /></label><label className="text-sm font-semibold">Imágenes iniciales<input type="file" accept="image/png" multiple disabled={busy} onChange={(event) => setImages(Array.from(event.target.files ?? []))} className="mt-2 block min-h-11 w-full text-sm" /></label></div><button type="button" disabled={busy || !inventory || images.length === 0} onClick={() => void start()} className="min-h-11 rounded-lg border border-white/20 px-4 text-sm font-semibold disabled:opacity-50">Cargar catálogo inicial</button>{message && <p role="status" className="text-sm text-arsen-muted">{message}</p>}{error && <p role="alert" className="text-sm text-arsen-purple2">{error}</p>}</section>
}
