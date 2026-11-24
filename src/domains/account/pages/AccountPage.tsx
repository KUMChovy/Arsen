import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Cloud, LockKeyhole, ShieldCheck } from 'lucide-react'
import type { AccountState } from '../native'
import { completeVerification, getAccountState, signIn, signOut } from '../services'
import { prepareManualBackup, queueManualBackup } from '../backupService'
import { prepareRestorePreview, applyRestorePreview, type RestorePreview } from '../restoreService'

export function AccountPage() {
  const [account, setAccount] = useState<AccountState | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [backupContext, setBackupContext] = useState<Awaited<ReturnType<typeof prepareManualBackup>> | null>(null)
  const [backupMessage, setBackupMessage] = useState('')
  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null)

  useEffect(() => {
    let active = true
    void getAccountState().then((state) => { if (active) setAccount(state) }).catch(() => { if (active) setAccount({ status: 'unavailable' }) })
    return () => { active = false }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try { setAccount(await signIn(email, password)) }
    catch { setError('No se pudo iniciar sesión. Revisa tus datos y tu conexión e inténtalo de nuevo.') }
    finally { setPassword(''); setBusy(false) }
  }

  async function verify() {
    setBusy(true); setError('')
    try { setAccount(await completeVerification()) }
    catch { setError('No se pudo completar la verificación. Inténtalo de nuevo.') }
    finally { setBusy(false) }
  }

  async function logout() {
    setBusy(true); setError('')
    try { await signOut(); setAccount({ status: 'signed-out' }); setEmail(''); setBackupContext(null); setRestorePreview(null); setBackupMessage('') }
    catch { setError('No se pudo cerrar la sesión. Inténtalo de nuevo.') }
    finally { setBusy(false) }
  }

  async function queueBackup(context: Awaited<ReturnType<typeof prepareManualBackup>>) {
    await queueManualBackup(context)
    setBackupContext(null)
    setBackupMessage('Copia preparada para envío. La confirmación depende de la conexión y del servidor.')
  }

  async function startBackup() {
    setBusy(true); setError(''); setBackupMessage(''); setBackupContext(null); setRestorePreview(null)
    try {
      const context = await prepareManualBackup()
      if (context.baseBackupId) setBackupContext(context)
      else await queueBackup(context)
    } catch { setError('No se pudo preparar el respaldo. Comprueba tu cuenta y conexión e inténtalo de nuevo.') }
    finally { setBusy(false) }
  }

  async function previewRestore() {
    setBusy(true); setError(''); setBackupMessage(''); setBackupContext(null); setRestorePreview(null)
    try { setRestorePreview(await prepareRestorePreview()) }
    catch { setError('No se pudo preparar la restauración. Comprueba tu conexión y espera a que termine cualquier respaldo pendiente.') }
    finally { setBusy(false) }
  }

  async function confirmRestore() {
    if (!restorePreview) return
    setBusy(true); setError('')
    try { await applyRestorePreview(restorePreview); setRestorePreview(null); setBackupMessage('Datos restaurados en este dispositivo.') }
    catch { setRestorePreview(null); setError('No se restauraron los datos. La cuenta, el respaldo o los datos locales pudieron cambiar; vuelve a intentarlo.') }
    finally { setBusy(false) }
  }

  async function confirmBackup() {
    if (!backupContext) return
    setBusy(true); setError('')
    try { await queueBackup(backupContext) }
    catch { setError('No se pudo preparar el respaldo. Comprueba tu cuenta y conexión e inténtalo de nuevo.') }
    finally { setBusy(false) }
  }

  const inputClass = 'mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-arsen-bg px-4 text-base text-arsen-ink outline-none transition focus:border-arsen-purple2 focus:ring-2 focus:ring-arsen-purple/40 disabled:opacity-60'
  return (
    <div className="pb-8">
      <Link to="/settings" className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-arsen-muted hover:text-arsen-ink focus-visible:outline-2 focus-visible:outline-arsen-purple2"><ArrowLeft size={18} aria-hidden="true" /> Ajustes</Link>
      <div className="overflow-hidden rounded-2xl border border-arsen-purple/40 bg-arsen-bg2">
        <div className="bg-arsen-purple px-6 py-7 text-arsen-bg">
          <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-xl border border-white/30 bg-black/15"><LockKeyhole size={22} aria-hidden="true" /></div>
          <h1 className="text-3xl font-black leading-tight">Tu cuenta,<br />tu progreso.</h1>
          <p className="mt-3 max-w-[28ch] text-sm font-medium leading-6">Conecta tu cuenta para preparar el respaldo de tus entrenamientos.</p>
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
          {account?.status === 'signed-in' && <div className="space-y-4"><div className="flex items-center gap-3"><ShieldCheck className="text-arsen-acid" aria-hidden="true" /><div><h2 className="font-bold">Sesión iniciada</h2><p className="break-all text-sm text-arsen-muted">{account.email}</p></div></div><p className="text-sm leading-6 text-arsen-muted">El respaldo automático está pendiente de configuración. Tus entrenamientos siguen guardados en este dispositivo.</p>
            <button disabled={busy} onClick={() => void startBackup()} className="min-h-12 w-full rounded-xl bg-arsen-purple2 px-4 font-bold text-arsen-bg disabled:opacity-50">{busy ? 'Preparando…' : 'Preparar respaldo'}</button>
            <button disabled={busy} onClick={() => void previewRestore()} className="min-h-12 w-full rounded-xl border border-arsen-purple/50 px-4 font-semibold text-arsen-purple2 disabled:opacity-50">Ver respaldo para restaurar</button>
            {backupContext && <div className="space-y-3 rounded-xl border border-arsen-purple/40 p-4"><p className="text-sm leading-6">Ya existe un respaldo en tu cuenta. Al continuar, prepararás una nueva versión con los datos de este dispositivo.</p><button disabled={busy} onClick={() => void confirmBackup()} className="min-h-12 w-full rounded-xl bg-arsen-purple2 px-4 font-bold text-arsen-bg disabled:opacity-50">Continuar con este dispositivo</button><button disabled={busy} onClick={() => setBackupContext(null)} className="min-h-11 w-full text-sm font-semibold text-arsen-muted">Cancelar</button></div>}
            {restorePreview && <div className="space-y-3 rounded-xl border border-arsen-purple/40 p-4"><h3 className="font-bold">Restaurar respaldo</h3><p className="text-sm leading-6 text-arsen-muted">{new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(restorePreview.summary.confirmedAt))} · {(restorePreview.summary.sizeBytes / 1024).toFixed(1)} KB · versión {restorePreview.summary.contractVersion}{restorePreview.summary.includesHealth ? ' · incluye datos de salud' : ''}</p><p className="text-sm leading-6">Esta acción reemplazará los datos locales de este dispositivo con los de la copia.</p><button disabled={busy} onClick={() => void confirmRestore()} className="min-h-12 w-full rounded-xl bg-arsen-purple2 px-4 font-bold text-arsen-bg disabled:opacity-50">Reemplazar datos locales</button><button disabled={busy} onClick={() => setRestorePreview(null)} className="min-h-11 w-full text-sm font-semibold text-arsen-muted">Cancelar</button></div>}
            {backupMessage && <p role="status" className="text-sm leading-6 text-arsen-ink">{backupMessage}</p>}
            <button disabled={busy} onClick={() => void logout()} className="min-h-12 w-full rounded-xl border border-white/20 px-4 font-semibold disabled:opacity-50">Cerrar sesión</button></div>}
          {error && <p role="alert" className="text-sm leading-6 text-arsen-purple2">{error}</p>}
          <div className="flex gap-3 border-t border-white/10 pt-5 text-sm leading-6 text-arsen-muted"><Cloud size={20} className="mt-0.5 shrink-0 text-arsen-purple2" aria-hidden="true" /><p>Iniciar sesión no activa el respaldo automáticamente. Tú decides cuándo configurarlo.</p></div>
        </div>
      </div>
      <Link to="/" className="mt-5 flex min-h-12 items-center justify-center text-sm font-semibold text-arsen-purple2 focus-visible:outline-2 focus-visible:outline-arsen-purple2">{account?.status === 'signed-in' ? 'Volver al entrenamiento' : 'Seguir como invitado'}</Link>
    </div>
  )
}
