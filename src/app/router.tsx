import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './AppShell'

const ProgressPage = lazy(() =>
  import('../domains/progress/pages/ProgressPage').then((module) => ({ default: module.ProgressPage })),
)
const RoutinePage = lazy(() =>
  import('../domains/routine/pages/RoutinePage').then((module) => ({ default: module.RoutinePage })),
)
const SettingsPage = lazy(() =>
  import('../domains/settings/pages/SettingsPage').then((module) => ({ default: module.SettingsPage })),
)
const WorkoutPage = lazy(() =>
  import('../domains/workout/pages/WorkoutPage').then((module) => ({ default: module.WorkoutPage })),
)

function RouteFallback() {
  return (
    <div className="space-y-3">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-white/10" />
      <div className="h-28 animate-pulse rounded-xl bg-white/10" />
      <div className="h-48 animate-pulse rounded-xl bg-white/10" />
    </div>
  )
}

function lazyPage(page: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{page}</Suspense>
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: lazyPage(<WorkoutPage />) },
      { path: '/rutina', element: lazyPage(<RoutinePage />) },
      { path: '/progreso', element: lazyPage(<ProgressPage />) },
      { path: '/settings', element: lazyPage(<SettingsPage />) },
    ],
  },
])
