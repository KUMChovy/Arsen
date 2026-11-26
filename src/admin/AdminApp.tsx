import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Activity, BookOpen, CircleUserRound, ClipboardList, LogOut, MailPlus, ShieldCheck } from 'lucide-react'
import { parseAdminDraft, type AdminDraft, type createAdminApi } from './api'
import type { AdminClerk } from './clerk'
import { canonicalName } from '../shared/utils/normalize'
import { catalogImageSchema } from '../shared/validation/remoteCatalog'
import type { z } from 'zod'
import { SeedImport } from './SeedImport'
import { confirmAction } from '../shared/utils/alerts'
import { useDialogFocus } from '../shared/components/useDialogFocus'

type Api = ReturnType<typeof createAdminApi>
type Section = 'Resumen' | 'Cuentas' | 'Catálogo' | 'Invitaciones' | 'Auditoría'
type Overview = Awaited<ReturnType<Api['overview']>>
type Account = Awaited<ReturnType<Api['accounts']>>['accounts'][number]
type Backup = Awaited<ReturnType<Api['backups']>>['backups'][number]
type CatalogItem = Awaited<ReturnType<Api['drafts']>>['items'][number]
const sections: Array<{ name: Section; icon: typeof Activity }> = [
  { name: 'Resumen', icon: Activity }, { name: 'Cuentas', icon: CircleUserRound },
  { name: 'Catálogo', icon: BookOpen }, { name: 'Invitaciones', icon: MailPlus },
  { name: 'Auditoría', icon: ClipboardList },
]
const muscles = ['Pecho', 'Espalda', 'Hombros', 'Brazos', 'Abdomen', 'Piernas'] as const
const field = 'mt-2 min-h-11 w-full rounded-lg border border-white/15 bg-arsen-bg px-3 text-arsen-ink focus-visible:outline-2 focus-visible:outline-arsen-purple2'
const action = 'min-h-11 rounded-lg bg-arsen-purple2 px-4 text-sm font-bold text-arsen-bg hover:brightness-110 disabled:opacity-50'
const secondary = 'min-h-10 rounded-lg border border-white/20 px-3 text-sm font-semibold text-arsen-ink hover:bg-white/5 disabled:opacity-50'
const errorText = (error: unknown) => error instanceof Error && ['No tienes permiso para esta operación', 'Inicia sesión para continuar', 'Los datos cambiaron. Actualiza e inténtalo de nuevo', 'Completa el ejercicio y utiliza una imagen verificada', 'Selecciona una imagen PNG, JPEG o WebP de hasta 10 MB', 'El archivo no coincide con el tipo de imagen', 'La protección del servidor rechazó la solicitud. Espera y vuelve a intentarlo.'].includes(error.message) ? error.message : 'No se pudo completar la operación. Revisa la conexión e inténtalo de nuevo.'
const date = (value: string) => new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(value))
const imageUrl = (item: CatalogItem) => { const image = catalogImageSchema.safeParse(item.draft.image); return image.success ? image.data.url : null }

export function AdminApp({ clerk, api }: { clerk: AdminClerk; api: Api }) {
  const [signedIn, setSignedIn] = useState(Boolean(clerk.session))
  const epoch = useRef(0)
  const sessionId = useRef(clerk.session?.id ?? null)
  const accountSelection = useRef(0)
  const catalogRequest = useRef(0)
  const uploadAbort = useRef<AbortController | null>(null)
  const invitationFlight = useRef<object | null>(null)
  const maintenanceFlight = useRef(false)
  const deletionFlight = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const [sessionVersion, setSessionVersion] = useState(0)
  const [section, setSection] = useState<Section>('Resumen')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [audit, setAudit] = useState<Awaited<ReturnType<Api['audit']>>['events'] | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountCursor, setAccountCursor] = useState<string | null>(null)
  const [backups, setBackups] = useState<Backup[] | null>(null)
  const [owner, setOwner] = useState('')
  const [items, setItems] = useState<CatalogItem[]>([])
  const [itemCursor, setItemCursor] = useState<string | null>(null)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogStatus, setCatalogStatus] = useState<'all' | 'draft' | 'published' | 'archived'>('all')
  const [catalogMuscle, setCatalogMuscle] = useState<'' | typeof muscles[number]>('')
  const catalogFilters = useRef<{ q: string; status: 'all' | 'draft' | 'published' | 'archived'; muscle?: '' | typeof muscles[number] } | undefined>(undefined)
  const [editorOpen, setEditorOpen] = useState(false)
  const dialogRef = useDialogFocus(() => { if (!busy) { setEditorOpen(false); resetDraft() } }, editorOpen)
  const [expected, setExpected] = useState<AdminDraft | null>(null)
  const [itemId, setItemId] = useState('')
  const [name, setName] = useState('')
  const [muscle, setMuscle] = useState('')
  const [notes, setNotes] = useState('')
  const [canonical, setCanonical] = useState('')
  const [aliases, setAliases] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [image, setImage] = useState<z.infer<typeof catalogImageSchema> | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [invitation, setInvitation] = useState<{ email: string; id: string } | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [maintenanceBusy, setMaintenanceBusy] = useState(false)
  const [maintenanceMessage, setMaintenanceMessage] = useState('')

  useEffect(() => clerk.addListener(() => {
    const nextSessionId = clerk.session?.id ?? null
    if (nextSessionId === sessionId.current) return
    sessionId.current = nextSessionId
    epoch.current += 1
    accountSelection.current += 1
    uploadAbort.current?.abort()
    invitationFlight.current = null
    maintenanceFlight.current = false; setMaintenanceBusy(false); setMaintenanceMessage('')
    deletionFlight.current = false
    setSessionVersion(epoch.current)
    const active = Boolean(clerk.session)
    setSignedIn(active)
    setOverview(null); setAudit(null); setAccounts([]); setBackups(null); setItems([]); setOwner(''); setExpected(null); setMessage(''); setError('')
    setAccountCursor(null); setItemCursor(null); setItemId(''); setName(''); setMuscle(''); setNotes(''); setCanonical(''); setAliases(''); setFile(null); setImage(null); setEmail(''); setInvitation(null); setBusy(false)
    catalogFilters.current = undefined; setCatalogSearch(''); setCatalogStatus('all'); setCatalogMuscle(''); setEditorOpen(false)
  }), [clerk])
  useEffect(() => () => uploadAbort.current?.abort(), [])

  useEffect(() => {
    if (!signedIn) return
    let active = true
    setError(''); setMessage(''); setBusy(true)
    const load = section === 'Resumen' ? api.overview().then((value) => { if (active) setOverview(value) })
      : section === 'Cuentas' ? api.accounts().then((value) => { if (active) { setAccounts(value.accounts); setAccountCursor(value.nextCursor) } })
      : section === 'Catálogo' ? Promise.resolve()
      : section === 'Auditoría' ? api.audit().then((value) => { if (active) setAudit(value.events) })
      : Promise.resolve()
    void load.catch((reason) => { if (active) setError(errorText(reason)) }).finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [api, section, signedIn, sessionVersion])

  useEffect(() => {
    if (!signedIn || section !== 'Catálogo') return
    const request = ++catalogRequest.current
    const filters = { q: catalogSearch.trim(), status: catalogStatus, ...(catalogMuscle ? { muscle: catalogMuscle } : {}) }
    catalogFilters.current = filters
    const timer = setTimeout(() => {
      setBusy(true); setError('')
      void api.drafts(undefined, filters).then((page) => {
        if (request === catalogRequest.current) { setItems(page.items); setItemCursor(page.nextCursor) }
      }).catch((reason) => { if (request === catalogRequest.current) setError(errorText(reason)) })
        .finally(() => { if (request === catalogRequest.current) setBusy(false) })
    }, 250)
    return () => { clearTimeout(timer); catalogRequest.current += 1 }
  }, [api, section, signedIn, sessionVersion, catalogSearch, catalogStatus, catalogMuscle])

  useEffect(() => {
    if (!file) { setFilePreview(null); return }
    const url = URL.createObjectURL(file)
    setFilePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  async function runMaintenance() {
    if (maintenanceFlight.current) return
    maintenanceFlight.current = true
    const version = epoch.current
    setMaintenanceBusy(true); setMaintenanceMessage(''); setError('')
    try {
      const confirmed = await confirmAction('Ejecutar limpieza', 'Se procesará una parte de la limpieza pendiente de respaldos. Las copias válidas se conservan.', 'Ejecutar')
      if (!confirmed || version !== epoch.current) return
      const result = await api.maintenance()
      if (version !== epoch.current) return
      const messages = { idle: 'No hay trabajo de limpieza listo ahora.', blocked: 'Una entrada sigue protegida; se revisará después.', complete: 'Se completó una entrada de limpieza.', pending: `${result.deleted} archivos eliminados. Puede quedar trabajo pendiente; vuelve a ejecutar si lo deseas.`, expired: 'Se preparó una carga vencida para limpieza posterior.' }
      setMaintenanceMessage(messages[result.result])
    } catch (reason) { if (version === epoch.current) setError(errorText(reason)) }
    finally { if (version === epoch.current) { maintenanceFlight.current = false; setMaintenanceBusy(false) } }
  }
  async function selectAccount(userId: string) {
    const version = epoch.current
    const selection = ++accountSelection.current
    setOwner(userId); setBackups(null); setError(''); setBusy(true)
    try { const result = await api.backups(userId); if (version === epoch.current && selection === accountSelection.current) setBackups(result.backups) } catch (reason) { if (version === epoch.current && selection === accountSelection.current) setError(errorText(reason)) } finally { if (version === epoch.current && selection === accountSelection.current) setBusy(false) }
  }
  async function deleteSelectedAccount() {
    if (!owner || deletionFlight.current) return
    deletionFlight.current = true
    const version = epoch.current
    const target = owner
    const selected = accounts.find((item) => item.userId === target)
    try {
      if (!selected?.deletionPending && !await confirmAction('Eliminar cuenta y respaldos', `Se eliminarán definitivamente la cuenta ${selected?.email ?? target} y sus respaldos de la nube. Los datos offline de sus teléfonos no se borran. El proceso requiere esperar al menos una hora y continuar desde este panel.`, 'Eliminar cuenta')) return
      if (version !== epoch.current) return
      setBusy(true); setError(''); setMessage('')
      const result = await api.deleteAccount(target)
      if (version !== epoch.current) return
      if (result.result === 'complete') {
        setAccounts((items) => items.filter((item) => item.userId !== target))
        setOwner((current) => current === target ? '' : current)
        setBackups(null)
        setMessage('Cuenta y respaldos eliminados de la nube.')
      } else {
        setAccounts((items) => items.map((item) => item.userId === target ? { ...item, deletionPending: true } : item))
        setMessage(result.result === 'waiting' ? 'Acceso bloqueado. Espera al menos una hora y continúa la eliminación desde esta cuenta.' : 'Se procesó un lote. Continúa la eliminación hasta completarla.')
      }
    } catch (reason) { if (version === epoch.current) setError(`${errorText(reason)} Vuelve a abrir Cuentas para revisar si quedó pendiente.`) }
    finally { if (version === epoch.current) setBusy(false); deletionFlight.current = false }
  }
  async function moreAccounts() {
    if (!accountCursor) return
    const version = epoch.current
    setBusy(true); setError('')
    try { const page = await api.accounts(accountCursor); if (version === epoch.current) { setAccounts((old) => [...old, ...page.accounts]); setAccountCursor(page.nextCursor) } }
    catch (reason) { if (version === epoch.current) setError(errorText(reason)) } finally { if (version === epoch.current) setBusy(false) }
  }
  async function refreshCatalog(cursor?: string) {
    const version = epoch.current
    const request = ++catalogRequest.current
    const page = await api.drafts(cursor, catalogFilters.current)
    if (version === epoch.current && request === catalogRequest.current) { setItems((old) => cursor ? [...old, ...page.items] : page.items); setItemCursor(page.nextCursor) }
  }
  async function moreCatalog() {
    if (!itemCursor) return
    const version = epoch.current
    setBusy(true); setError('')
    try { await refreshCatalog(itemCursor) } catch (reason) { if (version === epoch.current) setError(errorText(reason)) }
    finally { if (version === epoch.current) setBusy(false) }
  }
  async function searchCatalog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const version = epoch.current
    catalogFilters.current = { q: catalogSearch.trim(), status: catalogStatus, ...(catalogMuscle ? { muscle: catalogMuscle } : {}) }
    setBusy(true); setError('')
    try { await refreshCatalog() } catch (reason) { if (version === epoch.current) setError(errorText(reason)) } finally { if (version === epoch.current) setBusy(false) }
  }
  async function logout() {
    const version = epoch.current
    try { await clerk.signOut() } catch { if (version === epoch.current) setError('No se pudo cerrar la sesión. Inténtalo de nuevo.') }
  }
  async function openLogin() {
    setError('')
    try { await clerk.openSignIn() } catch { setError('No se pudo abrir el acceso. Revisa la conexión e inténtalo de nuevo.') }
  }
  function resetDraft() { setExpected(null); setItemId(''); setName(''); setMuscle(''); setNotes(''); setCanonical(''); setAliases(''); setImage(null); setFile(null); if (fileInput.current) fileInput.current.value = '' }
  function edit(item: CatalogItem) {
    const value = parseAdminDraft(item.draft)
    if (!value || value.id !== item.id) { setError('No se puede editar este borrador porque sus datos no son compatibles.'); return }
    const previousImage = catalogImageSchema.safeParse(value.image)
    setExpected(value); setItemId(value.id); setName(value.name); setMuscle(value.mainMuscle ?? ''); setNotes(value.technicalNotes ?? ''); setCanonical(value.canonicalName ?? ''); setAliases(value.aliases?.join(', ') ?? ''); setImage(previousImage.success ? previousImage.data : null); setFile(null); if (fileInput.current) fileInput.current.value = ''; setError(''); setMessage(''); setEditorOpen(true)
  }
  async function uploadImage() {
    if (!file || busy) return
    const version = epoch.current
    const controller = new AbortController()
    uploadAbort.current = controller
    setBusy(true); setError(''); setMessage('')
    try {
      const uploaded = await api.uploadImage(file, controller.signal)
      if (version === epoch.current && !controller.signal.aborted) { setImage(uploaded); setFile(null); if (fileInput.current) fileInput.current.value = ''; setMessage('Imagen lista. Guarda el borrador para asociarla.') }
    } catch (reason) { if (version === epoch.current && !controller.signal.aborted) setError(errorText(reason)) }
    finally { if (uploadAbort.current === controller) uploadAbort.current = null; if (version === epoch.current) setBusy(false) }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const version = epoch.current; setBusy(true); setError(''); setMessage('')
    try {
      const value: AdminDraft = { ...(expected ?? {}), id: itemId.trim(), name: name.trim() }
      value.canonicalName = canonical.trim() || canonicalName(name)
      value.aliases = aliases.split(/[,\n]/).map((alias) => alias.trim()).filter(Boolean)
      if (muscle) value.mainMuscle = muscle as AdminDraft['mainMuscle']; else delete value.mainMuscle
      if (notes || expected?.technicalNotes !== undefined) value.technicalNotes = notes
      if (image) value.image = image
      await api.saveDraft(value, expected)
      if (version !== epoch.current) return
      await refreshCatalog(); if (version !== epoch.current) return
      resetDraft(); setEditorOpen(false); setMessage('Borrador guardado. Todavía no está publicado.')
    } catch (reason) { if (version === epoch.current) setError(errorText(reason)) } finally { if (version === epoch.current) setBusy(false) }
  }
  async function changePublication(item: CatalogItem, actionName: 'publish' | 'archive') {
    const verb = actionName === 'publish' ? 'publicar' : 'archivar'
    const version = epoch.current
    if (!await confirmAction(`${actionName === 'publish' ? 'Publicar' : 'Archivar'} ejercicio`, `¿Quieres ${verb} este ejercicio del catálogo global?`, actionName === 'publish' ? 'Publicar' : 'Archivar')) return
    if (version !== epoch.current) return
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await (actionName === 'publish' ? api.publish(item.id) : api.archive(item.id))
      if (version !== epoch.current) return
      await refreshCatalog(); if (version !== epoch.current) return
      setMessage(`Cambio guardado en la versión ${result.version} del catálogo.`)
    } catch (reason) { if (version === epoch.current) setError(errorText(reason)) } finally { if (version === epoch.current) setBusy(false) }
  }
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (invitationFlight.current) return
    const flight = {}; invitationFlight.current = flight
    const version = epoch.current; setBusy(true); setError(''); setMessage('')
    const address = email.trim().toLowerCase()
    const attempt = invitation?.email === address ? invitation : { email: address, id: crypto.randomUUID() }
    setInvitation(attempt)
    try { await api.invite(attempt.id, attempt.email); if (version === epoch.current) { setMessage('Invitación solicitada. La entrega depende de Clerk.'); setEmail(''); setInvitation(null) } }
    catch (reason) { if (version === epoch.current) setError(errorText(reason)) } finally { if (invitationFlight.current === flight) invitationFlight.current = null; if (version === epoch.current) setBusy(false) }
  }

  if (!signedIn) return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12 text-arsen-ink"><div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-arsen-purple text-arsen-bg"><ShieldCheck aria-hidden="true" /></div><h1 className="text-4xl font-black">ARSEN Admin</h1><p className="mt-4 leading-7 text-arsen-muted">Acceso privado para administrar el catálogo, las cuentas y los respaldos.</p>{error && <p role="alert" className="mt-5 text-sm text-arsen-ink">{error}</p>}<button className={`${action} mt-8`} onClick={() => void openLogin()}>Iniciar sesión</button></main>

  return <div className="min-h-screen bg-arsen-bg text-arsen-ink lg:flex">
    <aside className="border-b border-white/10 px-5 py-5 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r lg:px-6 lg:py-8">
      <div><p className="text-xl font-black tracking-wide">ARSEN <span className="text-arsen-purple2">Admin</span></p><p className="mt-1 text-sm text-arsen-muted">Administración privada</p></div>
      <nav aria-label="Administración" className="mt-6 flex gap-2 overflow-x-auto pb-2 lg:mt-10 lg:flex-col">{sections.map(({ name: value, icon: Icon }) => <button key={value} onClick={() => { accountSelection.current += 1; setSection(value); setOwner(''); setBackups(null) }} aria-current={section === value ? 'page' : undefined} className={`flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold ${section === value ? 'bg-arsen-purple text-arsen-bg' : 'text-arsen-muted hover:bg-white/5 hover:text-arsen-ink'}`}><Icon size={18} aria-hidden="true" />{value}</button>)}</nav>
      <button className="mt-5 flex min-h-11 items-center gap-3 px-3 text-sm font-semibold text-arsen-muted hover:text-arsen-ink lg:mt-auto" onClick={() => void logout()}><LogOut size={18} aria-hidden="true" />Cerrar sesión</button>
    </aside>
    <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-12 lg:py-10"><div className="mx-auto max-w-6xl">
      <header className="mb-8"><h1 className="text-3xl font-black">{section}</h1><p className="mt-2 text-sm leading-6 text-arsen-muted">{section === 'Resumen' ? 'Estado actual de ARSEN.' : section === 'Cuentas' ? 'Consulta metadatos sin acceder al contenido personal.' : section === 'Catálogo' ? 'Prepara cambios y decide cuándo publicarlos.' : section === 'Auditoría' ? 'Consulta las operaciones administrativas registradas.' : 'Invita a una persona a crear su cuenta.'}</p></header>
      {error && <p role="alert" className="mb-5 rounded-lg border border-arsen-purple2/50 p-3 text-sm text-arsen-ink">{error}</p>}
      {message && <p role="status" className="mb-5 rounded-lg border border-arsen-acid/40 p-3 text-sm text-arsen-ink">{message}</p>}
      {busy && <p role="status" className="mb-4 text-sm text-arsen-muted">Cargando…</p>}
      {section === 'Resumen' && overview && <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Cuentas', overview.accounts], ['Dispositivos', overview.devices], ['Respaldos confirmados', overview.confirmedBackups], ['Ejercicios publicados', overview.publishedExercises]].map(([label, value]) => <div key={label} className="rounded-2xl border border-arsen-purple/30 bg-gradient-to-br from-arsen-surface to-arsen-purple/20 p-6"><dt className="text-sm text-arsen-muted">{label}</dt><dd className="mt-3 text-3xl font-black tabular-nums">{value}</dd></div>)}</dl>}
      {section === 'Resumen' && <section aria-labelledby="maintenance-title" className="mt-6 rounded-xl border border-white/10 p-5"><h2 id="maintenance-title" className="text-lg font-bold">Limpieza de respaldos</h2><p className="mt-2 text-sm leading-6 text-arsen-muted">Elimina archivos pendientes de limpieza en pequeños lotes. Solo se ejecuta cuando lo solicitas.</p><button className={`${secondary} mt-4`} disabled={maintenanceBusy} onClick={() => void runMaintenance()} type="button">{maintenanceBusy ? 'Procesando…' : 'Ejecutar limpieza'}</button>{maintenanceMessage && <p aria-live="polite" className="mt-3 text-sm text-arsen-ink">{maintenanceMessage}</p>}</section>}
      {section === 'Cuentas' && owner && <section aria-label="Eliminar cuenta seleccionada" className="mt-6 rounded-xl border border-red-400/30 p-4"><h2 className="font-bold">Eliminar cuenta</h2><p className="mt-2 break-all text-sm text-arsen-muted">Cuenta seleccionada: {accounts.find((item) => item.userId === owner)?.email ?? owner}. Se eliminan la cuenta y sus respaldos de la nube; los datos guardados en teléfonos permanecen.</p>{accounts.find((item) => item.userId === owner)?.deletionPending && <p className="mt-2 text-sm text-arsen-muted">Eliminación pendiente. Continúa para avanzar; después de bloquear el acceso hay que esperar al menos una hora.</p>}<button className="mt-3 min-h-11 rounded-lg border border-red-400/50 px-3 text-sm font-bold text-red-200 disabled:opacity-50" disabled={busy} onClick={() => void deleteSelectedAccount()} type="button">{accounts.find((item) => item.userId === owner)?.deletionPending ? 'Continuar eliminación' : 'Eliminar cuenta y respaldos'}</button></section>}
      {section === 'Auditoría' && audit && <section aria-label="Eventos administrativos" className="divide-y divide-white/10 rounded-xl border border-white/10"><p className="p-4 text-sm text-arsen-muted">Últimos 100 eventos registrados.</p>{audit.length === 0 && <p className="p-4 text-sm text-arsen-muted">No hay eventos registrados.</p>}{audit.map((event, index) => <div key={`${event.created_at}-${event.action}-${event.target_id}-${index}`} className="space-y-1 p-4 text-sm"><p className="font-semibold">{event.action} · {event.target_id}</p><p className="break-all text-arsen-muted">{event.actor_id} · {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.created_at))}</p></div>)}</section>}
      {section === 'Catálogo' && <SeedImport key={sessionVersion} api={api} onComplete={() => refreshCatalog()} />}
      {section === 'Catálogo' && <form onSubmit={searchCatalog} className="mb-5 flex flex-wrap items-end gap-3"><label className="min-w-48 flex-1 text-sm font-semibold">Buscar ejercicios<input className={field} value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} maxLength={200} /></label><label className="text-sm font-semibold">Estado<select className={field} value={catalogStatus} onChange={(event) => setCatalogStatus(event.target.value as typeof catalogStatus)}><option value="all">Todos</option><option value="draft">Borradores</option><option value="published">Publicados</option><option value="archived">Archivados</option></select></label><label className="text-sm font-semibold">Músculo<select className={field} value={catalogMuscle} onChange={(event) => setCatalogMuscle(event.target.value as typeof catalogMuscle)}><option value="">Todos</option>{muscles.map((value) => <option key={value}>{value}</option>)}</select></label><button className={action} disabled={busy}>Buscar</button><button type="button" className={secondary} onClick={() => { resetDraft(); setEditorOpen(true) }}>Agregar ejercicio</button></form>}
      {section === 'Cuentas' && <div className="grid gap-6 lg:grid-cols-[1fr_1fr]"><section aria-label="Cuentas"><div className="divide-y divide-white/10 rounded-xl border border-white/10">{accounts.map((account) => <button key={account.userId} onClick={() => void selectAccount(account.userId)} className="flex min-h-16 w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-white/5"><span className="min-w-0 break-all font-semibold">{account.email ?? account.userId}<span className="block text-sm font-normal text-arsen-muted">{account.role === 'admin' ? 'Administrador' : 'Usuario'} · {account.backupCount} respaldos</span></span><span className="text-arsen-purple2">Ver</span></button>)}{!busy && !error && accounts.length === 0 && <p className="p-4 text-sm text-arsen-muted">No hay cuentas para mostrar.</p>}</div>{accountCursor && <button className={`${secondary} mt-3`} disabled={busy} onClick={() => void moreAccounts()}>Cargar más cuentas</button>}</section><section aria-label="Respaldos de la cuenta" className="rounded-xl border border-white/10 p-5"><h2 className="font-bold">Respaldos confirmados</h2>{!owner && <p className="mt-3 text-sm text-arsen-muted">Selecciona una cuenta para consultar sus versiones.</p>}{owner && <p className="mt-2 break-all text-sm text-arsen-muted">{accounts.find((account) => account.userId === owner)?.email ?? owner}</p>}{backups?.length === 0 && <p className="mt-4 text-sm text-arsen-muted">No hay respaldos confirmados.</p>}{backups?.map((backup) => <div key={backup.id} className="mt-4 border-t border-white/10 pt-4 text-sm"><p className="font-semibold">{date(backup.confirmedAt)} · revisión {backup.localRevision}</p><p className="mt-1 break-all text-arsen-muted">{backup.id} · {backup.sizeBytes.toLocaleString('es-MX')} bytes</p></div>)}</section></div>}
      {section === 'Catálogo' && <div><section aria-label="Ejercicios del catálogo"><div className="divide-y divide-white/10 rounded-xl border border-white/10">{items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4"><div className="flex min-w-0 items-center gap-4">{imageUrl(item) && <img src={imageUrl(item)!} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-lg bg-arsen-surface object-cover" />}<div className="min-w-0"><p className="break-words font-semibold">{typeof item.draft.name === 'string' ? item.draft.name : item.id}</p><p className="break-all text-sm text-arsen-muted">{item.id} · {typeof item.draft.mainMuscle === 'string' ? item.draft.mainMuscle : 'Sin músculo'} · {item.archived ? 'Archivado' : item.published ? 'Publicado' : 'Borrador'}</p></div></div><div className="flex flex-wrap gap-2"><button className={secondary} disabled={busy} onClick={() => edit(item)}>Editar</button><button className={secondary} disabled={busy} onClick={() => void changePublication(item, 'publish')}>{item.archived ? 'Restaurar' : 'Publicar'}</button>{item.published && !item.archived && <button className={secondary} disabled={busy} onClick={() => void changePublication(item, 'archive')}>Archivar</button>}</div></div>)}{!busy && !error && items.length === 0 && <p className="p-4 text-sm text-arsen-muted">Aún no hay ejercicios para mostrar.</p>}</div>{itemCursor && <button className={`${secondary} mt-3`} disabled={busy} onClick={() => void moreCatalog()}>Cargar más ejercicios</button>}</section>{editorOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"><div ref={dialogRef as React.RefObject<HTMLDivElement>} role="dialog" aria-modal="true" aria-labelledby="editor-title" tabIndex={-1} className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/15 bg-arsen-surface p-5"><form onSubmit={save} className="space-y-4">{error && <p role="alert" className="rounded-lg border border-arsen-purple2/50 p-3 text-sm">{error}</p>}<div><h2 id="editor-title" className="text-lg font-bold">{expected ? 'Editar borrador' : 'Nuevo borrador'}</h2><p className="mt-1 text-sm text-arsen-muted">Guardar no publica el ejercicio.</p></div><label className="block text-sm font-semibold">Identificador<input className={field} value={itemId} onChange={(event) => setItemId(event.target.value)} required maxLength={128} disabled={!!expected || busy} /></label><label className="block text-sm font-semibold">Nombre<input className={field} value={name} onChange={(event) => setName(event.target.value)} required maxLength={200} disabled={busy} /></label><label className="block text-sm font-semibold">Músculo principal<select className={field} value={muscle} onChange={(event) => setMuscle(event.target.value)} disabled={busy}><option value="">Seleccionar</option>{muscles.map((value) => <option key={value}>{value}</option>)}</select></label><label className="block text-sm font-semibold">Nombre normalizado<input className={field} value={canonical} onChange={(event) => setCanonical(event.target.value)} placeholder="Se genera a partir del nombre" maxLength={200} disabled={busy} /></label><label className="block text-sm font-semibold">Alias<input className={field} value={aliases} onChange={(event) => setAliases(event.target.value)} placeholder="Separados por comas" disabled={busy} /></label><label className="block text-sm font-semibold">Notas técnicas<textarea className={field + " min-h-24 py-3"} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={10000} disabled={busy} /></label><label className="block text-sm font-semibold">Imagen del ejercicio<input ref={fileInput} className={field + " py-2"} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} disabled={busy} /></label>{(filePreview || image?.url) && <img src={filePreview || image?.url} alt="Vista previa del ejercicio" className="aspect-video w-full rounded-xl object-contain bg-arsen-bg" />}<p className="text-sm leading-6 text-arsen-muted">{image ? "Imagen cargada para este borrador." : "Selecciona una imagen PNG, JPEG o WebP de hasta 10 MB."}</p><button type="button" className={secondary} disabled={!file || busy} onClick={() => void uploadImage()}>Subir imagen</button><div className="flex flex-wrap gap-2"><button className={action} disabled={busy} type="submit">Guardar borrador</button><button className={secondary} disabled={busy} type="button" onClick={() => { setEditorOpen(false); resetDraft() }}>Cancelar edición</button></div></form></div></div>}</div>}
      {section === 'Invitaciones' && <form onSubmit={invite} className="max-w-md space-y-4 rounded-xl border border-white/10 bg-arsen-surface p-5"><label className="block text-sm font-semibold">Correo electrónico<input className={field} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={254} required disabled={busy} /></label><p className="text-sm leading-6 text-arsen-muted">Clerk enviará la invitación; el acceso requiere aceptarla.</p><button className={action} disabled={busy} type="submit">Enviar invitación</button></form>}
    </div></main>
  </div>
}
