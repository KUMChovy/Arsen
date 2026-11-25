import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Cloud, ShieldCheck } from 'lucide-react'
import logo from '../../../assets/tkh.png'
import type { AccountState } from '../native'
import { completeVerification, getAccountState, signIn, signOut } from '../services'
import { prepareManualBackup, queueManualBackup, requestBackupNotifications, getBackupStatus } from '../backupService'
import { prepareRestorePreview, applyRestorePreview, listRestoreVersions, type RestorePreview } from '../restoreService'
import { enableAutomaticBackup, disableAutomaticBackup, isAutomaticBackupEnabled, getAutomaticBackupSchedule, observeAutomaticPreparation } from '../automaticBackup'

export function AccountPage({ onContinue, offerRestoreOnLoad = false }: { onContinue?: () => void; offerRestoreOnLoad?: boolean } = {}) {
  const [account, setAccount] = useState<AccountState | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [backupContext, setBackupContext] = useState<Awaited<ReturnType<typeof prepareManualBackup>> | null>(null)
  const [backupMessage, setBackupMessage] = useState('')
  const [notificationMessage, setNotificationMessage] = useState('')
  const notificationRequested = useRef(false)
  const restoreRef = useRef<HTMLDivElement>(null)
  const backupConfirmRef = useRef<HTMLDivElement>(null)
  const versionsRef = useRef<HTMLDivElement>(null)
  const feedbackRef = useRef<HTMLParagraphElement>(null)
  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null)
  const [versions, setVersions] = useState<Awaited<ReturnType<typeof listRestoreVersions>>['backups'] | null>(null)
  const [loginBackup, setLoginBackup] = useState<Awaited<ReturnType<typeof listRestoreVersions>>['backups'][number] | null>(null)
  const [syncStatus, setSyncStatus] = useState<Awaited<ReturnType<typeof getBackupStatus>> | 'error' | null>(null)
  const [statusVersion, setStatusVersion] = useState(0)
  const [automaticEnabled, setAutomaticEnabled] = useState(false)
  const [schedule, setSchedule] = useState<Awaited<ReturnType<typeof getAutomaticBackupSchedule>>>(null)
  const [preparation, setPreparation] = useState<'idle' | 'preparing' | 'error'>('idle')
  const [confirmationAction, setConfirmationAction] = useState<'manual' | 'automatic'>('manual')

  useEffect(() => {
    let active = true
    void getAccountState().then(async (state) => {
      if (!active) return
      setAccount(state)
      if (offerRestoreOnLoad && state.status === 'signed-in') {
        if (!notificationRequested.current) {
          notificationRequested.current = true
          try { const enabled = await requestBackupNotifications(); if (active && !enabled) setNotificationMessage('Las notificaciones están desactivadas. Puedes habilitarlas en los ajustes de Android.') }
          catch { if (active) setNotificationMessage('No se pudo solicitar el permiso de notificaciones. Puedes intentarlo desde esta pantalla.') }
        }
        try { const result = await listRestoreVersions(); if (active) setLoginBackup(result.backups[0] ?? null) }
        catch { if (active) setBackupMessage('No se pudo consultar el respaldo. Puedes revisarlo más tarde en esta pantalla.') }
      }
    }).catch(() => { if (active) setAccount({ status: 'unavailable' }) })
    return () => { active = false }
  }, [offerRestoreOnLoad])

  useEffect(() => observeAutomaticPreparation(setPreparation), [])

  useEffect(() => {
    if (restorePreview) restoreRef.current?.focus()
  }, [restorePreview])
  useEffect(() => { if (backupContext) backupConfirmRef.current?.focus() }, [backupContext])
  useEffect(() => { if (versions) versionsRef.current?.focus() }, [versions])
  useEffect(() => { if (backupMessage) feedbackRef.current?.focus() }, [backupMessage])

  useEffect(() => {
    if (account?.status !== 'signed-in') { setSyncStatus(null); setAutomaticEnabled(false); setSchedule(null); return }
    let active = true
    setSyncStatus(null)
    void getBackupStatus().then((result) => { if (active) setSyncStatus(result) }).catch(() => { if (active) setSyncStatus('error') })
    void isAutomaticBackupEnabled().then((enabled) => { if (active) setAutomaticEnabled(enabled) }).catch(() => { if (active) setAutomaticEnabled(false) })
    void getAutomaticBackupSchedule().then((value) => { if (active) setSchedule(value) }).catch(() => { if (active) setSchedule(null) })
    return () => { active = false }
  }, [account, statusVersion])

  async function acceptAccount(state: AccountState) {
    setAccount(state)
    if (state.status === 'signed-in') {
      if (!notificationRequested.current) {
        notificationRequested.current = true
        try { if (!await requestBackupNotifications()) setNotificationMessage('Las notificaciones están desactivadas. Puedes habilitarlas en los ajustes de Android.') }
        catch { setNotificationMessage('No se pudo solicitar el permiso de notificaciones. Puedes intentarlo desde esta pantalla.') }
      }
      try { setLoginBackup((await listRestoreVersions()).backups[0] ?? null) }
      catch { setBackupMessage('No se pudo consultar el respaldo. Puedes revisarlo más tarde en esta pantalla.') }
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      await acceptAccount(await signIn(email, password))
    }
    catch { setError('No se pudo iniciar sesión. Revisa tus datos y tu conexión e inténtalo de nuevo.') }
    finally { setPassword(''); setBusy(false) }
  }

  async function verify() {
    setBusy(true); setError('')
    try { await acceptAccount(await completeVerification()) }
    catch { setError('No se pudo completar la verificación. Inténtalo de nuevo.') }
    finally { setBusy(false) }
  }

  async function logout() {
    setBusy(true); setError('')
    try { await signOut(); setAccount({ status: 'signed-out' }); setEmail(''); setBackupContext(null); setRestorePreview(null); setVersions(null); setLoginBackup(null); setBackupMessage(''); setNotificationMessage(''); notificationRequested.current = false }
    catch { setError('No se pudo cerrar la sesión. Inténtalo de nuevo.') }
    finally { setBusy(false) }
  }

  async function queueBackup(context: Awaited<ReturnType<typeof prepareManualBackup>>) {
    const result = await queueManualBackup(context)
    setStatusVersion((value) => value + 1)
    setBackupContext(null)
    setBackupMessage(result === 'unchanged' ? 'Los datos coinciden con la última copia confirmada.' : 'Copia preparada para envío. La confirmación depende de la conexión y del servidor.')
  }

  async function startBackup() {
    setBusy(true); setError(''); setBackupMessage(''); setBackupContext(null); setRestorePreview(null)
    setConfirmationAction('manual')
    try {
      const context = await prepareManualBackup()
      if (context.baseBackupId) setBackupContext(context)
      else await queueBackup(context)
    } catch { setError('No se pudo preparar el respaldo. Comprueba tu cuenta y conexión e inténtalo de nuevo.') }
    finally { setBusy(false) }
  }

  async function startAutomaticBackup() {
    setBusy(true); setError(''); setBackupMessage(''); setBackupContext(null); setRestorePreview(null)
    setConfirmationAction('automatic')
    try {
      const context = await prepareManualBackup()
      if (context.baseBackupId) setBackupContext(context)
      else { const result = await enableAutomaticBackup(context); setAutomaticEnabled(true); setStatusVersion((value) => value + 1); setBackupMessage(result === 'unchanged' ? 'Respaldo automático activado. Los datos coinciden con la última copia confirmada.' : 'Respaldo automático activado. La primera copia está pendiente de confirmación.') }
    } catch { setError('No se pudo activar el respaldo automático. Comprueba tu cuenta y conexión.') }
    finally { setBusy(false) }
  }

  async function stopAutomaticBackup() {
    setBusy(true); setError(''); setBackupMessage('')
    try { await disableAutomaticBackup(); setAutomaticEnabled(false); setSchedule(null); setBackupMessage('Respaldo automático desactivado. Las copias pendientes se conservan.') }
    catch { setError('No se pudo desactivar el respaldo automático. Vuelve a intentarlo.') }
    finally { setBusy(false) }
  }

  async function loadVersions() {
    setBusy(true); setError(''); setVersions(null); setRestorePreview(null)
    try { setVersions((await listRestoreVersions()).backups) }
    catch { setError('No se pudieron consultar las versiones. Comprueba tu cuenta y conexión.') }
    finally { setBusy(false) }
  }

  async function enableNotifications() {
    setBusy(true); setError(''); setBackupMessage('')
    try { setBackupMessage(await requestBackupNotifications() ? 'Notificaciones de respaldo activadas.' : 'Las notificaciones están desactivadas. Puedes habilitarlas en los ajustes de Android.') }
    catch { setError('No se pudieron activar las notificaciones. Revisa los ajustes de Android.') }
    finally { setBusy(false) }
  }

  async function previewRestore(id?: string) {
    setBusy(true); setError(''); setBackupMessage(''); setBackupContext(null); setRestorePreview(null)
    try { setRestorePreview(await prepareRestorePreview(id)) }
    catch { setError('No se pudo preparar la restauración. Comprueba tu conexión y espera a que termine cualquier respaldo pendiente.') }
    finally { setBusy(false) }
  }

  async function confirmRestore() {
    if (!restorePreview) return
    setBusy(true); setError('')
    try { await applyRestorePreview(restorePreview); setRestorePreview(null); setBackupMessage('Datos restaurados en este dispositivo.'); setStatusVersion((value) => value + 1) }
    catch { setRestorePreview(null); setError('No se restauraron los datos. La cuenta, el respaldo o los datos locales pudieron cambiar; vuelve a intentarlo.') }
    finally { setBusy(false) }
  }

  async function confirmBackup() {
    if (!backupContext) return
    setBusy(true); setError('')
    try {
      if (confirmationAction === 'automatic') {
        const result = await enableAutomaticBackup(backupContext); setAutomaticEnabled(true); setBackupContext(null); setStatusVersion((value) => value + 1)
        setBackupMessage(result === 'unchanged' ? 'Respaldo automático activado. Los datos coinciden con la última copia confirmada.' : 'Respaldo automático activado. La primera copia está pendiente de confirmación.')
      } else await queueBackup(backupContext)
    }
    catch { setError('No se pudo preparar el respaldo. Comprueba tu cuenta y conexión e inténtalo de nuevo.') }
    finally { setBusy(false) }
  }

  const inputClass = 'mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-arsen-bg px-4 text-base text-arsen-ink outline-none transition focus:border-arsen-purple2 focus:ring-2 focus:ring-arsen-purple/40 disabled:opacity-60'
  return (
    <div className={account?.status === 'signed-in' ? 'pb-8' : 'fixed inset-0 z-50 mx-auto w-full max-w-[430px] overflow-y-auto bg-arsen-bg pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(18px,env(safe-area-inset-top))]'}>
      {!onContinue && <Link to="/settings" className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-arsen-muted hover:text-arsen-ink focus-visible:outline-2 focus-visible:outline-arsen-purple2"><ArrowLeft size={18} aria-hidden="true" /> Ajustes</Link>}
      <div className={account?.status === 'signed-in' ? 'overflow-hidden rounded-2xl border border-arsen-purple/40 bg-arsen-bg2' : 'overflow-hidden bg-arsen-bg'}>
        <div className={account?.status === 'signed-in' ? 'relative overflow-hidden bg-gradient-to-br from-arsen-bg via-arsen-bg2 to-arsen-purple/40 px-6 py-8' : 'relative flex min-h-[35dvh] flex-col justify-end overflow-hidden bg-gradient-to-br from-arsen-bg via-arsen-purple/30 to-arsen-bg px-7 pb-8 pt-6'}>
          <img src={logo} alt="TKH" className="mb-6 h-16 w-16 object-contain" />
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-arsen-purple2">ARSEN · {account?.status === 'signed-in' ? 'Tu espacio' : 'Bienvenido'}</p>
          <h1 className="mt-3 text-3xl font-black leading-tight">{account?.status === 'signed-in' ? 'Cuenta y respaldos' : <>Tu cuenta,<br />tu progreso.</>}</h1>
          <p className="mt-3 max-w-[30ch] text-sm leading-6 text-arsen-muted">{account?.status === 'signed-in' ? 'Administra tu sesión y mantén a la vista tus copias.' : 'Conecta tu cuenta para preparar el respaldo de tus entrenamientos.'}</p>
        </div>
        <div className="space-y-6 px-6 py-6">
          {account === null && <p role="status" className="text-sm text-arsen-muted">Consultando tu cuenta…</p>}
          {account?.status === 'unavailable' && <p className="text-sm leading-6 text-arsen-muted">La cuenta está disponible en la app Android configurada. Puedes seguir entrenando sin iniciar sesión.</p>}
          {account?.status === 'signed-out' && <form onSubmit={submit} className="space-y-5">
            <div><h2 className="text-xl font-bold">Iniciar sesión</h2><p className="mt-1 text-sm leading-6 text-arsen-muted">Usa la cuenta con la que recibiste tu invitación.</p></div>
            <label className="block text-sm font-semibold">Correo electrónico<input className={inputClass} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={320} disabled={busy} /></label>
            <label className="block text-sm font-semibold">Contraseña<input className={inputClass} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required maxLength={1024} disabled={busy} /></label>
            <button type="submit" disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-arsen-purple2 px-4 font-bold text-arsen-bg transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-arsen-purple2 disabled:opacity-50">{busy ? 'Conectando…' : 'Iniciar sesión'} <ArrowRight size={18} aria-hidden="true" /></button>
          </form>}
          {account?.status === 'verification-required' && <div className="space-y-4"><h2 className="text-xl font-bold">Un paso más</h2><p className="text-sm leading-6 text-arsen-muted">Tu cuenta necesita una verificación adicional. Complétala en la página segura de Clerk para continuar.</p><button disabled={busy} onClick={() => void verify()} className="min-h-12 w-full rounded-xl bg-arsen-purple2 px-4 font-bold text-arsen-bg disabled:opacity-50">{busy ? 'Abriendo…' : 'Completar verificación'}</button></div>}
          {account?.status === 'signed-in' && <div className="space-y-4"><div className="flex items-center gap-3"><ShieldCheck className="text-arsen-acid" aria-hidden="true" /><div><h2 className="font-bold">Sesión iniciada</h2><p className="break-all text-sm text-arsen-muted">{account.email}</p></div></div><p className="text-sm leading-6 text-arsen-muted">{automaticEnabled ? 'Respaldo automático activado: comprobación aproximada cada tres días, preferentemente de madrugada.' : 'El respaldo automático está pendiente de configuración. Tus entrenamientos siguen guardados en este dispositivo.'}</p>
            {notificationMessage && <p role="status" className="text-sm leading-6 text-arsen-muted">{notificationMessage}</p>}
            {backupMessage && <p ref={feedbackRef} tabIndex={-1} role="status" className="rounded-xl border border-arsen-purple/50 bg-arsen-purple/10 p-4 text-sm leading-6 text-arsen-ink focus:outline-2 focus:outline-arsen-purple2">{backupMessage}</p>}
            {restorePreview && <div ref={restoreRef} tabIndex={-1} role="region" aria-label="Confirmar restauración" className="space-y-3 rounded-xl border-2 border-arsen-purple2 bg-arsen-purple/10 p-4 outline-none focus:ring-2 focus:ring-arsen-purple2"><h3 className="font-bold">Restaurar respaldo</h3><p className="text-sm leading-6 text-arsen-muted">Confirmada o reconfirmada: {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(restorePreview.summary.confirmedAt))} · {(restorePreview.summary.sizeBytes / 1024).toFixed(1)} KB · versión {restorePreview.summary.contractVersion}{restorePreview.summary.includesHealth ? ' · incluye datos de salud' : ''}</p><p className="text-sm leading-6">Esta acción reemplazará los datos locales de este dispositivo con los de la copia.</p><button disabled={busy} onClick={() => void confirmRestore()} className="min-h-12 w-full rounded-xl bg-arsen-purple2 px-4 font-bold text-arsen-bg disabled:opacity-50">Reemplazar datos locales</button><button disabled={busy} onClick={() => setRestorePreview(null)} className="min-h-11 w-full text-sm font-semibold text-arsen-muted">Cancelar</button></div>}
            {loginBackup && <section aria-label="Respaldo encontrado" className="space-y-3 rounded-xl border border-arsen-purple/40 p-4"><h3 className="font-bold">Encontramos un respaldo</h3><p className="text-sm leading-6 text-arsen-muted">{new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(loginBackup.confirmedAt))} · {loginBackup.sizeBytes.toLocaleString('es-MX')} bytes</p><p className="text-sm leading-6">Puedes revisarlo antes de decidir. Restaurarlo reemplazará los datos locales.</p><button disabled={busy} onClick={() => { const id = loginBackup.id; setLoginBackup(null); void previewRestore(id) }} className="min-h-12 w-full rounded-xl bg-arsen-purple2 px-4 font-bold text-arsen-bg disabled:opacity-50">Revisar respaldo</button><button disabled={busy} onClick={() => setLoginBackup(null)} className="min-h-11 w-full text-sm font-semibold text-arsen-muted">Decidir después</button></section>}
            <section aria-label="Estado de respaldo" className="space-y-2 border-y border-white/10 py-4 text-sm leading-6"><p>Datos guardados en este dispositivo.</p>{syncStatus === null && <p role="status" className="text-arsen-muted">Consultando el estado…</p>}{syncStatus === 'error' && <p className="text-arsen-muted">No se pudo consultar el estado en la nube. Los datos locales permanecen en este dispositivo.</p>}{syncStatus && syncStatus !== 'error' && <><p className="text-arsen-muted">{syncStatus.unpreparedChanges === true ? 'Hay cambios locales que todavía no se han preparado.' : syncStatus.unpreparedChanges === false ? 'Los cambios locales se han preparado o confirmado.' : 'No se pudo determinar si hay cambios locales sin preparar.'}</p><p className="text-arsen-muted">{syncStatus.pending ? 'Hay una copia preparada pendiente de envío o confirmación.' : 'No hay copia preparada pendiente.'}</p><p className="text-arsen-muted">{syncStatus.confirmed ? `Última copia confirmada: ${new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(syncStatus.confirmed.confirmedAt))}.` : 'No hay copias confirmadas en la nube.'}</p></>}<button disabled={busy} onClick={() => setStatusVersion((value) => value + 1)} className="min-h-11 font-semibold text-arsen-purple2 disabled:opacity-50">Actualizar estado</button></section>
            {automaticEnabled && <div className="space-y-2 text-sm leading-6 text-arsen-muted">{preparation === 'preparing' && <p role="status">Comprobando cambios para preparar la copia…</p>}{preparation === 'error' && <p role="alert">No se pudo preparar la copia automática. Los cambios locales siguen pendientes; ARSEN lo reintentará.</p>}<p>{schedule?.state === 'RUNNING' ? 'Comprobando copia preparada…' : schedule?.state === 'NOT_SCHEDULED' || schedule?.state === 'CANCELLED' ? 'La comprobación aún no está programada; abre la app para reintentarlo.' : schedule?.nextCheckAt && schedule.nextCheckAt > Date.now() ? `Próxima comprobación estimada a partir de ${new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(schedule.nextCheckAt))}.` : 'La próxima comprobación depende de Android y de la conexión.'}</p><p>Los cambios que no se alcancen a preparar antes de cerrar la app se prepararán al volver a abrirla. Android puede retrasar la comprobación y no la ejecuta tras una detención forzada hasta que abras la app.</p></div>}
            <section aria-label="Crear respaldos" className="space-y-3 rounded-xl border border-white/10 bg-arsen-surface p-4"><div><h3 className="font-bold">Crear respaldos</h3><p className="mt-1 text-sm leading-6 text-arsen-muted">Guarda una copia ahora o deja que Android revise los cambios periódicamente.</p></div>
            <button disabled={busy} onClick={() => void startBackup()} className="min-h-12 w-full rounded-xl bg-arsen-purple2 px-4 font-bold text-arsen-bg disabled:opacity-50">{busy ? 'Preparando…' : 'Preparar respaldo'}</button>
            {!automaticEnabled && <button disabled={busy} onClick={() => void startAutomaticBackup()} className="min-h-12 w-full rounded-xl border border-arsen-purple/50 px-4 font-semibold text-arsen-purple2 disabled:opacity-50">Activar respaldo automático</button>}
            {automaticEnabled && <button disabled={busy} onClick={() => void stopAutomaticBackup()} className="min-h-12 w-full rounded-xl border border-white/20 px-4 font-semibold disabled:opacity-50">Desactivar respaldo automático</button>}</section>
            <section aria-label="Recuperar datos" className="space-y-3 rounded-xl border border-white/10 bg-arsen-surface p-4"><div><h3 className="font-bold">Recuperar datos</h3><p className="mt-1 text-sm leading-6 text-arsen-muted">Revisa una copia confirmada antes de reemplazar los datos de este dispositivo.</p></div>
            <button disabled={busy} onClick={() => void previewRestore()} className="min-h-12 w-full rounded-xl border border-arsen-purple/50 px-4 font-semibold text-arsen-purple2 disabled:opacity-50">Ver respaldo para restaurar</button>
            <button disabled={busy} onClick={() => void loadVersions()} className="min-h-12 w-full rounded-xl border border-white/20 px-4 font-semibold disabled:opacity-50">Consultar versiones</button></section>
            <button disabled={busy} onClick={() => void enableNotifications()} className="min-h-12 w-full rounded-xl border border-white/20 px-4 font-semibold disabled:opacity-50">Activar notificaciones de respaldo</button>
            {versions && <div ref={versionsRef} tabIndex={-1} role="region" aria-label="Versiones confirmadas" className="space-y-2 rounded-xl border border-arsen-purple/40 p-4 focus:outline-2 focus:outline-arsen-purple2"><h3 className="font-bold">Versiones confirmadas</h3>{versions.length === 0 && <p className="text-sm text-arsen-muted">No hay copias confirmadas.</p>}{versions.map((version) => <div key={version.id} className="flex items-center justify-between gap-3 border-b border-white/10 py-2"><p className="text-sm text-arsen-muted">Confirmada o reconfirmada: {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(version.confirmedAt))} · {(version.sizeBytes / 1024).toFixed(1)} KB</p><button disabled={busy} onClick={() => void previewRestore(version.id)} className="min-h-11 shrink-0 text-sm font-semibold text-arsen-purple2 disabled:opacity-50" aria-label={`Seleccionar copia confirmada el ${new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(version.confirmedAt))}`}>Seleccionar</button></div>)}</div>}
            {backupContext && <div ref={backupConfirmRef} tabIndex={-1} role="region" aria-label="Confirmar respaldo" className="space-y-3 rounded-xl border-2 border-arsen-purple2 bg-arsen-purple/10 p-4 focus:outline-2 focus:outline-arsen-purple2"><p className="text-sm leading-6">Ya existe un respaldo en tu cuenta. Al continuar, prepararás una nueva versión con los datos de este dispositivo.</p><button disabled={busy} onClick={() => void confirmBackup()} className="min-h-12 w-full rounded-xl bg-arsen-purple2 px-4 font-bold text-arsen-bg disabled:opacity-50">Continuar con este dispositivo</button><button disabled={busy} onClick={() => setBackupContext(null)} className="min-h-11 w-full text-sm font-semibold text-arsen-muted">Cancelar</button></div>}
            <button disabled={busy} onClick={() => void logout()} className="min-h-12 w-full rounded-xl border border-white/20 px-4 font-semibold disabled:opacity-50">Cerrar sesión</button></div>}
          {error && <p role="alert" className="text-sm leading-6 text-arsen-purple2">{error}</p>}
          <div className="flex gap-3 border-t border-white/10 pt-5 text-sm leading-6 text-arsen-muted"><Cloud size={20} className="mt-0.5 shrink-0 text-arsen-purple2" aria-hidden="true" /><p>Iniciar sesión no activa el respaldo automáticamente. Tú decides cuándo configurarlo.</p></div>
        </div>
      </div>
      <Link to="/" onClick={onContinue} className="mt-5 flex min-h-12 items-center justify-center text-sm font-semibold text-arsen-purple2 focus-visible:outline-2 focus-visible:outline-arsen-purple2">{account?.status === 'signed-in' ? 'Volver al entrenamiento' : 'Seguir como invitado'}</Link>
    </div>
  )
}
