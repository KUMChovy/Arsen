import { useEffect, useState, type ReactNode } from 'react'
import { CircleHelp } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useLocation } from 'react-router-dom'
import { db } from '../db/schema'
import { HeaderActionsContext } from '../shared/components/HeaderActions'
import { NotificationCenterHost } from '../domains/settings/NotificationPanel'
import { PageTour, pageTourForPath } from './PageTour'

export function PageTourShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const page = pageTourForPath(pathname)
  const records = useLiveQuery(async () => ({ general: await db.localMetadata.get('productTour'), pages: await db.localMetadata.get('pageTours') }), [], undefined)
  const [readyPath, setReadyPath] = useState('')
  const [manualPath, setManualPath] = useState('')
  const [error, setError] = useState(false)
  useEffect(() => {
    setReadyPath(''); setManualPath(''); setError(false)
    const update = () => { if (document.querySelector('main h1') && !(pathname === '/' && document.querySelector('[data-tour-workout-loading]'))) setReadyPath(pathname) }
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.body, { subtree: true, childList: true })
    return () => observer.disconnect()
  }, [pathname])
  const completed = records?.pages?.id === 'pageTours' ? records.pages.value : []
  const generalPending = !records || records.general?.id === 'productTour' && records.general.value === 'pending'
  const show = Boolean(page && readyPath === pathname && !generalPending && (manualPath === pathname || !completed.includes(page)))
  function finish() {
    if (!page) return
    setError(false)
    void db.transaction('rw', db.localMetadata, async () => {
      const previous = await db.localMetadata.get('pageTours')
      const pages = previous?.id === 'pageTours' ? previous.value : []
      if (!pages.includes(page)) await db.localMetadata.put({ id: 'pageTours', value: [...pages, page] })
    }).then(() => setManualPath('')).catch(() => setError(true))
  }
  const actions = <><button aria-label="Ayuda de esta página" className="grid size-11 place-items-center rounded-xl border border-white/10 bg-arsen-surface text-arsen-purple2 focus-visible:outline-2 focus-visible:outline-arsen-purple2 disabled:opacity-50" disabled={!page || generalPending} onClick={() => setManualPath(pathname)} type="button"><CircleHelp aria-hidden="true" className="size-5" /></button><NotificationCenterHost /></>
  return <HeaderActionsContext.Provider value={actions}>{children}{show && page ? <PageTour key={page} page={page} error={error} onFinish={finish} /> : null}</HeaderActionsContext.Provider>
}
