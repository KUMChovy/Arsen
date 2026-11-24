import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Activity, BookOpen, CircleUserRound, LogOut, MailPlus, ShieldCheck } from 'lucide-react'
import { parseAdminDraft, type AdminDraft, type createAdminApi } from './api'
import type { AdminClerk } from './clerk'
import { canonicalName } from '../shared/utils/normalize'
import { catalogImageSchema } from '../shared/validation/remoteCatalog'
import type { z } from 'zod'

type Api = ReturnType<typeof createAdminApi>
type Section = 'Resumen' | 'Cuentas' | 'Catálogo' | 'Invitaciones'
type Overview = Awaited<ReturnType<Api['overview']>>
type Account = Awaited<ReturnType<Api['accounts']>>['accounts'][number]
type Backup = Awaited<ReturnType<Api['backups']>>['backups'][number]
type CatalogItem = Awaited<ReturnType<Api['drafts']>>['items'][number]
const sections: Array<{ name: Section; icon: typeof Activity }> = [
  { name: 'Resumen', icon: Activity }, { name: 'Cuentas', icon: CircleUserRound },
  { name: 'Catálogo', icon: BookOpen }, { name: 'Invitaciones', icon: MailPlus },
]
const muscles = ['Pecho', 'Espalda', 'Hombros', 'Brazos', 'Abdomen', 'Piernas'] as const
const field = 'mt-2 min-h-11 w-full rounded-lg border border-white/15 bg-arsen-bg px-3 text-arsen-ink focus-visible:outline-2 focus-visible:outline-arsen-purple2'
const action = 'min-h-11 rounded-lg bg-arsen-purple2 px-4 text-sm font-bold text-arsen-bg hover:brightness-110 disabled:opacity-50'
const secondary = 'min-h-10 rounded-lg border border-white/20 px-3 text-sm font-semibold text-arsen-ink hover:bg-white/5 disabled:opacity-50'
const errorText = (error: unknown) => error instanceof Error && ['No tienes permiso para esta operación', 'Inicia sesión para continuar', 'Los datos cambiaron. Actualiza e inténtalo de nuevo', 'Completa el ejercicio y utiliza una imagen verificada', 'Selecciona una imagen PNG, JPEG o WebP de hasta 10 MB', 'El archivo no coincide con el tipo de imagen'].includes(error.message) ? error.message : 'No se pudo completar la operación. Revisa la conexión e inténtalo de nuevo.'
const date = (value: string) => new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(value))

export function AdminApp({ clerk, api }: { clerk: AdminClerk; api: Api }) {
  const [signedIn, setSignedIn] = useState(Boolean(clerk.session))
  const epoch = useRef(0)
  const sessionId = useRef(clerk.session?.id ?? null)
  const accountSelection = useRef(0)
  const uploadAbort = useRef<AbortController | null>(null)
  const invitationFlight = useRef<object | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [sessionVersion, setSessionVersion] = useState(0)
  const [section, setSection] = useState<Section>('Resumen')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountCursor, setAccountCursor] = useState<string | null>(null)
  const [backups, setBackups] = useState<Backup[] | null>(null)
  const [owner, setOwner] = useState('')
  const [items, setItems] = useState<CatalogItem[]>([])
  const [itemCursor, setItemCursor] = useState<string | null>(null)
  const [expected, setExpected] = useState<AdminDraft | null>(null)
  const [itemId, setItemId] = useState('')
  const [name, setName] = useState('')
  const [muscle, setMuscle] = useState('')
  const [notes, setNotes] = useState('')
  const [canonical, setCanonical] = useState('')
  const [aliases, setAliases] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [image, setImage] = useState<z.infer<typeof catalogImageSchema> | null>(null)
  const [email, setEmail] = useState('')
  const [invitation, setInvitation] = useState<{ email: string; id: string } | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => clerk.addListener(() => {
    const nextSessionId = clerk.session?.id ?? null
    if (nextSessionId === sessionId.current) return
    sessionId.current = nextSessionId
    epoch.current += 1
    accountSelection.current += 1
    uploadAbort.current?.abort()
    invitationFlight.current = null
    setSessionVersion(epoch.current)
    const active = Boolean(clerk.session)
    setSignedIn(active)
    setOverview(null); setAccounts([]); setBackups(null); setItems([]); setOwner(''); setExpected(null); setMessage(''); setError('')
    setAccountCursor(null); setItemCursor(null); setItemId(''); setName(''); setMuscle(''); setNotes(''); setCanonical(''); setAliases(''); setFile(null); setImage(null); setEmail(''); setInvitation(null); setBusy(false)
  }), [clerk])
  useEffect(() => () => uploadAbort.current?.abort(), [])

  useEffect(() => {
    if (!signedIn) return
    let active = true
    setError(''); setMessage(''); setBusy(true)
    const load = section === 'Resumen' ? api.overview().then((value) => { if (active) setOverview(value) })
      : section === 'Cuentas' ? api.accounts().then((value) => { if (active) { setAccounts(value.accounts); setAccountCursor(value.nextCursor) } })
      : section === 'Catálogo' ? api.drafts().then((value) => { if (active) { setItems(value.items); setItemCursor(value.nextCursor) } })
      : Promise.resolve()
    void load.catch((reason) => { if (active) setError(errorText(reason)) }).finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [api, section, signedIn, sessionVersion])

  async function selectAccount(userId: string) {
    const version = epoch.current
    const selection = ++accountSelection.current
    setOwner(userId); setBackups(null); setError(''); setBusy(true)
    try { const result = await api.backups(userId); if (version === epoch.current && selection === accountSelection.current) setBackups(result.backups) } catch (reason) { if (version === epoch.current && selection === accountSelection.current) setError(errorText(reason)) } finally { if (version === epoch.current && selection === accountSelection.current) setBusy(false) }
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
    const page = await api.drafts(cursor)
    if (version === epoch.current) { setItems((old) => cursor ? [...old, ...page.items] : page.items); setItemCursor(page.nextCursor) }
  }
  async function moreCatalog() {
    if (!itemCursor) return
    const version = epoch.current
    setBusy(true); setError('')
    try { await refreshCatalog(itemCursor) } catch (reason) { if (version === epoch.current) setError(errorText(reason)) }
    finally { if (version === epoch.current) setBusy(false) }
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
    setExpected(value); setItemId(value.id); setName(value.name); setMuscle(value.mainMuscle ?? ''); setNotes(value.technicalNotes ?? ''); setCanonical(value.canonicalName ?? ''); setAliases(value.aliases?.join(', ') ?? ''); setImage(previousImage.success ? previousImage.data : null); setFile(null); if (fileInput.current) fileInput.current.value = ''; setError(''); setMessage('')
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
      resetDraft(); setMessage('Borrador guardado. Todavía no está publicado.')
    } catch (reason) { if (version === epoch.current) setError(errorText(reason)) } finally { if (version === epoch.current) setBusy(false) }
  }
  async function changePublication(item: CatalogItem, actionName: 'publish' | 'archive') {
    const verb = actionName === 'publish' ? 'publicar' : 'archivar'
    if (!window.confirm(`¿Quieres ${verb} este ejercicio del catálogo global?`)) return
    const version = epoch.current
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
      <header className="mb-8"><h1 className="text-3xl font-black">{section}</h1><p className="mt-2 text-sm leading-6 text-arsen-muted">{section === 'Resumen' ? 'Estado actual de ARSEN.' : section === 'Cuentas' ? 'Consulta metadatos sin acceder al contenido personal.' : section === 'Catálogo' ? 'Prepara cambios y decide cuándo publicarlos.' : 'Invita a una persona a crear su cuenta.'}</p></header>
      {error && <p role="alert" className="mb-5 rounded-lg border border-arsen-purple2/50 p-3 text-sm text-arsen-ink">{error}</p>}
      {message && <p role="status" className="mb-5 rounded-lg border border-arsen-acid/40 p-3 text-sm text-arsen-ink">{message}</p>}
      {busy && <p role="status" className="mb-4 text-sm text-arsen-muted">Cargando…</p>}
      {section === 'Resumen' && overview && <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[['Cuentas', overview.accounts], ['Dispositivos', overview.devices], ['Respaldos confirmados', overview.confirmedBackups], ['Ejercicios publicados', overview.publishedExercises]].map(([label, value]) => <div key={label} className="rounded-xl border border-white/10 bg-arsen-surface p-5"><dt className="text-sm text-arsen-muted">{label}</dt><dd className="mt-3 text-3xl font-black tabular-nums">{value}</dd></div>)}</dl>}
      {section === 'Cuentas' && <div className="grid gap-6 lg:grid-cols-[1fr_1fr]"><section aria-label="Cuentas"><div className="divide-y divide-white/10 rounded-xl border border-white/10">{accounts.map((account) => <button key={account.userId} onClick={() => void selectAccount(account.userId)} className="flex min-h-16 w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-white/5"><span className="min-w-0 break-all font-semibold">{account.userId}<span className="block text-sm font-normal text-arsen-muted">{account.role === 'admin' ? 'Administrador' : 'Usuario'} · {account.backupCount} respaldos</span></span><span className="text-arsen-purple2">Ver</span></button>)}{!busy && !error && accounts.length === 0 && <p className="p-4 text-sm text-arsen-muted">No hay cuentas para mostrar.</p>}</div>{accountCursor && <button className={`${secondary} mt-3`} disabled={busy} onClick={() => void moreAccounts()}>Cargar más cuentas</button>}</section><section aria-label="Respaldos de la cuenta" className="rounded-xl border border-white/10 p-5"><h2 className="font-bold">Respaldos confirmados</h2>{!owner && <p className="mt-3 text-sm text-arsen-muted">Selecciona una cuenta para consultar sus versiones.</p>}{owner && <p className="mt-2 break-all text-sm text-arsen-muted">{owner}</p>}{backups?.length === 0 && <p className="mt-4 text-sm text-arsen-muted">No hay respaldos confirmados.</p>}{backups?.map((backup) => <div key={backup.id} className="mt-4 border-t border-white/10 pt-4 text-sm"><p className="font-semibold">{date(backup.confirmedAt)} · revisión {backup.localRevision}</p><p className="mt-1 break-all text-arsen-muted">{backup.id} · {backup.sizeBytes.toLocaleString('es-MX')} bytes</p></div>)}</section></div>}
      {section === 'Catálogo' && <div className="grid gap-6 xl:grid-cols-[1fr_24rem]"><section aria-label="Ejercicios del catálogo"><div className="divide-y divide-white/10 rounded-xl border border-white/10">{items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4"><div className="min-w-0"><p className="break-words font-semibold">{typeof item.draft.name === 'string' ? item.draft.name : item.id}</p><p className="break-all text-sm text-arsen-muted">{item.id} · {item.archived ? 'Archivado' : item.published ? 'Publicado' : 'Borrador'}</p></div><div className="flex flex-wrap gap-2"><button className={secondary} disabled={busy} onClick={() => edit(item)}>Editar</button><button className={secondary} disabled={busy} onClick={() => void changePublication(item, 'publish')}>{item.archived ? 'Restaurar' : 'Publicar'}</button>{item.published && !item.archived && <button className={secondary} disabled={busy} onClick={() => void changePublication(item, 'archive')}>Archivar</button>}</div></div>)}{!busy && !error && items.length === 0 && <p className="p-4 text-sm text-arsen-muted">Aún no hay ejercicios para mostrar.</p>}</div>{itemCursor && <button className={`${secondary} mt-3`} disabled={busy} onClick={() => void moreCatalog()}>Cargar más ejercicios</button>}</section><form onSubmit={save} className="space-y-4 rounded-xl border border-white/10 bg-arsen-surface p-5"><div><h2 className="text-lg font-bold">{expected ? 'Editar borrador' : 'Nuevo borrador'}</h2><p className="mt-1 text-sm text-arsen-muted">Guardar no publica el ejercicio.</p></div><label className="block text-sm font-semibold">Identificador<input className={field} value={itemId} onChange={(event) => setItemId(event.target.value)} required maxLength={128} disabled={!!expected || busy} /></label><label className="block text-sm font-semibold">Nombre<input className={field} value={name} onChange={(event) => setName(event.target.value)} required maxLength={200} disabled={busy} /></label><label className="block text-sm font-semibold">Músculo principal<select className={field} value={muscle} onChange={(event) => setMuscle(event.target.value)} disabled={busy}><option value="">Seleccionar</option>{muscles.map((value) => <option key={value}>{value}</option>)}</select></label><label className="block text-sm font-semibold">Nombre normalizado<input className={field} value={canonical} onChange={(event) => setCanonical(event.target.value)} placeholder="Se genera a partir del nombre" maxLength={200} disabled={busy} /></label><label className="block text-sm font-semibold">Alias<input className={field} value={aliases} onChange={(event) => setAliases(event.target.value)} placeholder="Separados por comas" disabled={busy} /></label><label className="block text-sm font-semibold">Notas técnicas<textarea className={field + " min-h-24 py-3"} value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={10000} disabled={busy} /></label><label className="block text-sm font-semibold">Imagen del ejercicio<input ref={fileInput} className={field + " py-2"} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} disabled={busy} /></label><p className="text-sm leading-6 text-arsen-muted">{image ? "Imagen cargada para este borrador." : "Selecciona una imagen PNG, JPEG o WebP de hasta 10 MB."}</p><button type="button" className={secondary} disabled={!file || busy} onClick={() => void uploadImage()}>Subir imagen</button><div className="flex flex-wrap gap-2"><button className={action} disabled={busy} type="submit">Guardar borrador</button>{expected && <button className={secondary} type="button" onClick={resetDraft}>Cancelar edición</button>}</div></form></div>}
      {section === 'Invitaciones' && <form onSubmit={invite} className="max-w-md space-y-4 rounded-xl border border-white/10 bg-arsen-surface p-5"><label className="block text-sm font-semibold">Correo electrónico<input className={field} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" maxLength={254} required disabled={busy} /></label><p className="text-sm leading-6 text-arsen-muted">Clerk enviará la invitación; el acceso requiere aceptarla.</p><button className={action} disabled={busy} type="submit">Enviar invitación</button></form>}
    </div></main>
  </div>
}
