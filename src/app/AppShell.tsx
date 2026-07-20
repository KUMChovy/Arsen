import { NavLink, Outlet } from 'react-router-dom'
import { navItems } from './navigation'

export function AppShell() {
  return (
    <div className="min-h-dvh bg-arsen-bg text-arsen-ink">
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-arsen-bg2 shadow-[0_0_0_1px_rgb(255_255_255_/_0.05)]">
        <main className="flex-1 overflow-y-auto px-4 pb-28 pt-[max(18px,env(safe-area-inset-top))]">
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
