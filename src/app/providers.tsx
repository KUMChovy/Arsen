import type { PropsWithChildren } from 'react'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { ensureDemoData } from '../db/seedDemoRoutine'

type DatabaseStatus = 'loading' | 'ready' | 'error'

type AppProvidersValue = {
  databaseStatus: DatabaseStatus
  databaseError: string | null
}

const AppProvidersContext = createContext<AppProvidersValue | null>(null)

export function AppProviders({ children }: PropsWithChildren) {
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus>('loading')
  const [databaseError, setDatabaseError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    ensureDemoData()
      .then(() => {
        if (cancelled) return
        setDatabaseStatus('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setDatabaseStatus('error')
        setDatabaseError(error instanceof Error ? error.message : 'No se pudo iniciar IndexedDB')
      })

    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(() => ({ databaseError, databaseStatus }), [databaseError, databaseStatus])

  return <AppProvidersContext.Provider value={value}>{children}</AppProvidersContext.Provider>
}

export function useAppProviders() {
  const value = useContext(AppProvidersContext)
  if (!value) throw new Error('useAppProviders must be used inside AppProviders')

  return value
}
