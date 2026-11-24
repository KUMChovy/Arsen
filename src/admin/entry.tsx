import { createRoot } from 'react-dom/client'
import { AdminApp } from './AdminApp'
import { createAdminApi } from './api'
import { loadAdminClerk } from './clerk'
import { getStableAdminToken, readAdminConfig } from './config'
import '../../admin/styles.css'

declare const __ARSEN_ADMIN_CLERK_KEY__: string
declare const __ARSEN_ADMIN_API_ORIGIN__: string

const container = document.getElementById('root')
if (!container) throw new Error('Falta el contenedor de administración')
const root = createRoot(container)
root.render(<main className="mx-auto max-w-md px-6 py-16 text-arsen-ink"><p role="status">Preparando administración…</p></main>)

async function start() {
  try {
    const config = readAdminConfig(__ARSEN_ADMIN_CLERK_KEY__, __ARSEN_ADMIN_API_ORIGIN__, window.location.origin)
    const clerk = await loadAdminClerk(config.publishableKey)
    const api = createAdminApi(config.apiOrigin, () => getStableAdminToken(clerk))
    root.render(<AdminApp clerk={clerk} api={api} />)
  } catch {
    root.render(<main className="mx-auto max-w-md px-6 py-16 text-arsen-ink"><h1 className="text-2xl font-black">ARSEN Admin</h1><p role="alert" className="mt-4 leading-7 text-arsen-muted">No se pudo iniciar administración. Comprueba la conexión y la configuración del servidor.</p></main>)
  }
}

void start()
