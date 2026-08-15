import { useLiveQuery } from 'dexie-react-hooks'
import { NavLink, Outlet } from 'react-router-dom'
import { navItems } from './navigation'
import { useAppProviders } from './providers'
import { getDeloadOverview } from '../domains/settings/services'

export function AppShell() {
  const { databaseError, databaseStatus } = useAppProviders()
  const deload = useLiveQuery(() => getDeloadOverview(), [], undefined)
  const deloadActive = deload?.phase === 'active'

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
          <Outlet />
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto grid h-[84px] max-w-[430px] grid-cols-4 border-t border-white/10 bg-arsen-bg2/95 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
          {navItems.map((item) => (
            <NavLink
              className={({ isActive }) =>
                [
                  'grid place-items-center gap-1 rounded-lg text-[11px] font-medium transition-colors',
                  isActive ? 'text-arsen-purple' : 'text-arsen-muted hover:text-arsen-ink',
                ].join(' ')
              }
              end={item.path === '/'}
              key={item.path}
              to={item.path}
            >
              <item.icon aria-hidden="true" className="size-6" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
