import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { isNativeAccount } from '../account/native'
import { openBackupNotificationSettings, requestBackupNotifications } from '../account/backupService'
import { getNoticeCenterEnabled, setNoticeCenterEnabled } from './notificationCenter'

export function NotificationPreferences() {
  const enabled = useLiveQuery(() => getNoticeCenterEnabled(), [], true) ?? true
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage('')
    try { await action() } catch { setMessage('No se pudo actualizar. Inténtalo de nuevo.') } finally { setBusy(false) }
  }
  return <div className="space-y-3">
    <div className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-white/10 p-3"><div><strong>Avisos en el centro</strong><p className="text-xs text-arsen-muted">Oculta los avisos activos de la campana; los avisos en pantalla siguen disponibles.</p></div><button aria-checked={enabled} aria-label="Avisos en el centro" className={`relative h-8 w-14 shrink-0 rounded-full ${enabled ? 'bg-arsen-purple' : 'bg-white/20'} disabled:opacity-50`} disabled={busy} onClick={() => void run(() => setNoticeCenterEnabled(!enabled))} role="switch" type="button"><span className={`absolute top-1 size-6 rounded-full bg-white transition-transform ${enabled ? 'left-1 translate-x-6' : 'left-1'}`} /></button></div>
    <div className="rounded-xl border border-white/10 p-3"><strong>Notificaciones de Android</strong><p className="mt-1 text-xs text-arsen-muted">El permiso del dispositivo controla las notificaciones de respaldo. Puedes cambiarlo en Android.</p>{isNativeAccount() ? <div className="mt-2 flex flex-wrap gap-2"><button className="min-h-12 rounded-lg border border-white/20 px-3 text-sm font-bold" disabled={busy} onClick={() => void run(async () => { setMessage(await requestBackupNotifications() ? 'Notificaciones de Android permitidas.' : 'Permiso desactivado; revisa los ajustes de Android.') })} type="button">Solicitar permiso de Android</button><button className="min-h-12 rounded-lg border border-white/20 px-3 text-sm font-bold" disabled={busy} onClick={() => void run(openBackupNotificationSettings)} type="button">Abrir ajustes de Android</button></div> : <p className="mt-2 text-sm text-arsen-muted">Disponible en la app Android.</p>}</div>
    {message && <p role="status" className="text-sm text-arsen-ink">{message}</p>}
  </div>
}
