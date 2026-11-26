import { Bell } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { useDialogFocus } from '../../shared/components/useDialogFocus'
import { currentWeekStart, dismissNotice, getNotices, getNoticeCenterEnabled, pruneNoticeHistory, type AppNotice } from './notificationCenter'

export function NotificationCenterHost() {
  const navigate = useNavigate()
  const notices = useLiveQuery(() => getNotices().catch(() => []), [], []) ?? []
  const enabled = useLiveQuery(() => getNoticeCenterEnabled().catch(() => true), [], true) ?? true
  const [error, setError] = useState(false)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const prune = () => { void pruneNoticeHistory().catch(() => setError(true)); const next = new Date(); next.setHours(24, 0, 0, 0); timer = setTimeout(prune, next.getTime() - Date.now() + 50) }
    prune()
    return () => clearTimeout(timer)
  }, [])
  return <div><NotificationCenter notices={notices} enabled={enabled} onOpenBackup={() => navigate('/cuenta')} onDismiss={(id) => { setError(false); void dismissNotice(id).catch(() => setError(true)) }} />{error ? <p role="alert" className="text-xs text-red-300">No se pudo actualizar el centro de avisos.</p> : null}</div>
}

export function NotificationCenter({ notices, onDismiss, onOpenBackup, enabled = true }: { notices: AppNotice[]; onDismiss: (id: string) => void; onOpenBackup?: () => void; enabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const dialogRef = useDialogFocus(() => setOpen(false), open)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const active = enabled ? notices.filter((item) => !item.dismissed) : []
  const history = notices.filter((item) => item.dismissed && Date.parse(item.createdAt) >= currentWeekStart().getTime())
  return <>
    <button aria-label={`Notificaciones${active.length ? `, ${active.length} activas` : ''}`} className="relative grid size-12 place-items-center rounded-xl border border-white/10 bg-arsen-surface text-arsen-purple2 focus-visible:outline-2 focus-visible:outline-arsen-purple2" onClick={() => setOpen(true)} type="button">
      <Bell aria-hidden="true" className="size-5" />
      {active.length ? <span aria-hidden="true" className="absolute right-2 top-2 size-2 rounded-full bg-arsen-acid" /> : null}
    </button>
    {open ? <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end bg-black/65">
      <section aria-labelledby="notification-center-title" aria-modal="true" className="max-h-[85dvh] w-full overflow-y-auto rounded-t-[22px] bg-arsen-bg2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" ref={dialogRef} role="dialog" tabIndex={-1}>
        <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black" id="notification-center-title">Notificaciones</h2><button className="min-h-12 px-3 font-bold text-arsen-purple2" onClick={() => setOpen(false)} type="button">Cerrar</button></div>
        <h3 className="mt-4 font-bold">Activas</h3>
        {!enabled ? <p className="mt-2 text-sm text-arsen-muted">Los avisos del centro están desactivados en Ajustes.</p> : null}
        {active.length ? <ul className="mt-2 space-y-2">{active.map((notice) => <li className="touch-pan-y rounded-xl border border-white/10 bg-arsen-surface p-3" key={notice.id} onPointerDown={(event) => { pointerStart.current = { x: event.clientX, y: event.clientY } }} onPointerUp={(event) => { const start = pointerStart.current; if (start && Math.abs(event.clientX - start.x) >= 70 && Math.abs(event.clientX - start.x) > Math.abs(event.clientY - start.y)) onDismiss(notice.id); pointerStart.current = null }} onPointerCancel={() => { pointerStart.current = null }}>
          <strong>{notice.title}</strong><p className="mt-1 text-sm text-arsen-muted">{notice.body}</p>{notice.id.startsWith('manual-backup:') && onOpenBackup ? <button className="mr-4 min-h-12 text-sm font-bold text-arsen-purple2" onClick={() => { setOpen(false); onOpenBackup() }} type="button">Ir a Cuenta y respaldo</button> : null}<button aria-label={`Descartar ${notice.title}`} className="mt-1 min-h-12 text-sm font-bold text-arsen-purple2" onClick={() => onDismiss(notice.id)} type="button">Descartar</button>
        </li>)}</ul> : <p className="mt-2 text-sm text-arsen-muted">No tienes avisos activos.</p>}
        <details className="mt-4"><summary className="min-h-12 cursor-pointer py-3 font-bold">Historial de esta semana</summary>{history.length ? <ul className="space-y-2">{history.map((notice) => <li className="rounded-xl border border-white/10 p-3" key={notice.id}><strong>{notice.title}</strong><p className="mt-1 text-sm text-arsen-muted">{notice.body}</p></li>)}</ul> : <p className="text-sm text-arsen-muted">No hay avisos descartados esta semana.</p>}</details>
      </section>
    </div> : null}
  </>
}
