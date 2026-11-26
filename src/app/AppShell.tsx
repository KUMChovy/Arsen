import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { navItems } from './navigation'
import { useAppProviders } from './providers'
import { useHealthAutoSync } from '../domains/health/hooks'
import { getAppSettings } from '../domains/settings/services'
import { useDeloadOverview } from '../domains/settings/hooks'
import { useGlobalCatalogSync } from '../domains/routine/hooks'
import { syncNotices } from '../domains/settings/notificationCenter'
import { observeAutomaticPreparation } from '../domains/account/automaticBackup'
import { localDateKey } from '../shared/utils/date'
import { ProductTourHost } from './ProductTour'
import { PageTourShell } from './PageTourShell'
import { consumeBackupReminder } from '../domains/account/backupReminder'

export function AppShell() {
  const { databaseError, databaseStatus } = useAppProviders()
  const deload = useDeloadOverview()
  const appSettings = useLiveQuery(() => getAppSettings(), [], undefined)
  const [workoutAction, setWorkoutAction] = useState<(() => void) | null>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const deloadActive = deload?.phase === 'active'
  useHealthAutoSync(appSettings?.healthIntegrationEnabled === true)
  useGlobalCatalogSync(databaseStatus === 'ready')
  useEffect(() => {
    if (databaseStatus !== 'ready') return
    let active = true
    const openReminder = () => {
      if (document.visibilityState === 'hidden') return
      void consumeBackupReminder().then((open) => { if (active && open) navigate('/cuenta') }).catch(() => undefined)
    }
    openReminder()
    document.addEventListener('visibilitychange', openReminder)
    window.addEventListener('focus', openReminder)
    return () => { active = false; document.removeEventListener('visibilitychange', openReminder); window.removeEventListener('focus', openReminder) }
  }, [databaseStatus, navigate])
  useEffect(() => {
    if (databaseStatus !== 'ready' || !deload) return
    const notices = deload.phase === 'suggested' ? [{ id: `deload:${deload.anchorDate ?? 'suggested'}`, title: 'Semana de descarga', body: 'Revisa tu sugerencia de descanso en Ajustes.' }] : []
    void syncNotices('deload:', notices).catch(() => undefined)
  }, [databaseStatus, deload?.phase, deload?.anchorDate])
  useEffect(() => {
    if (databaseStatus !== 'ready') return
    return observeAutomaticPreparation((state) => {
      const notices = state === 'error' ? [{ id: `backup:${localDateKey(new Date())}`, title: 'Respaldo pendiente', body: 'No se pudo preparar la copia automática. Tus datos locales se conservan.' }] : []
      if (state !== 'preparing') void syncNotices('backup:', notices).catch(() => undefined)
    })
  }, [databaseStatus])

  return (
    <div className="min-h-dvh bg-arsen-bg text-arsen-ink">
      <div
        className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-arsen-bg2 shadow-[0_0_0_1px_rgb(255_255_255_/_0.05)]"
        data-deload-active={deloadActive ? 'true' : undefined}
        data-testid="app-shell"
      >
        <main className="flex-1 overflow-y-auto px-4 pb-28 pt-[max(18px,env(safe-area-inset-top))]">
          {databaseStatus === 'loading' ? (
            <div className="mb-3 rounded-[10px] border border-white/10 bg-white/5 px-3 py-2 text-xs text-arsen-muted">
              Preparando datos offline...
            </div>
          ) : null}
          {databaseStatus === 'error' ? (
            <div className="mb-3 rounded-[10px] border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              IndexedDB no inició: {databaseError}
            </div>
          ) : null}
          {databaseStatus === 'ready' ? <PageTourShell><Outlet context={{ setWorkoutAction, openAccount: () => navigate('/cuenta') }} /></PageTourShell> : <Outlet context={{ setWorkoutAction }} />}
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto grid h-[84px] max-w-[430px] grid-cols-5 border-t border-white/10 bg-arsen-bg2/95 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
          {navItems.map((item) => item.path === '/' && location.pathname === '/' ? (
            <button aria-label="Registrar ejercicio" data-tour="entreno" className="group grid place-items-center gap-1 rounded-lg text-[11px] font-black text-arsen-ink disabled:text-arsen-muted" disabled={!workoutAction} key={item.path} onClick={() => workoutAction?.()} type="button">
              <span className="-mt-5 grid size-14 place-items-center rounded-full border-4 border-arsen-bg2 bg-arsen-purple2 text-arsen-bg"><Plus aria-hidden="true" className="size-6" /></span>
              <span>Registrar</span>
            </button>
          ) : (
            <NavLink
              className={({ isActive }) =>
                [
                  'grid place-items-center gap-1 rounded-lg text-[11px] font-medium transition-colors',
                  item.path === '/' ? `group font-black ${isActive ? 'text-arsen-ink' : 'text-arsen-muted hover:text-arsen-ink'}` : isActive ? 'text-arsen-purple' : 'text-arsen-muted hover:text-arsen-ink',
                ].join(' ')
              }
              end={item.path === '/'}
              data-tour={({ '/': 'entreno', '/rutina': 'rutina', '/progreso': 'progreso', '/historial': 'historial', '/settings': 'ajustes' } as Record<string, string>)[item.path]}
              key={item.path}
              to={item.path}
            >
              <span className={item.path === '/' ? '-mt-5 grid size-14 place-items-center rounded-full border-4 border-arsen-bg2 bg-arsen-purple2 text-arsen-bg' : 'grid size-6 place-items-center'}><item.icon aria-hidden="true" className="size-6" /></span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        {databaseStatus === 'ready' ? <ProductTourHost /> : null}
      </div>
    </div>
  )
}
