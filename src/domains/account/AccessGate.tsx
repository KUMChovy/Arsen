import { lazy, Suspense, useState, type ReactNode } from 'react'
import { isNativeAccount } from './native'
import { registerWithInvitation } from './services'
import logo from '../../assets/tkh.png'
const AccountPage = lazy(() => import('./pages/AccountPage').then((module) => ({ default: module.AccountPage })))

const accessKey = 'arsen.initial-access.v1'
function wasChosen() {
  try { return localStorage.getItem(accessKey) === 'chosen' } catch { return false }
}

export function AccessGate({ children }: { children: ReactNode }) {
  const [entered, setEntered] = useState(() => !isNativeAccount() || wasChosen())
  const [accountPage, setAccountPage] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  function enter() {
    try { localStorage.setItem(accessKey, 'chosen') } catch { /* The current session remains usable. */ }
    setEntered(true)
  }
  async function register() {
    setBusy(true); setError('')
    try {
      const state = await registerWithInvitation()
      if (state.status !== 'signed-in') throw new Error('Registro incompleto')
      setRegistered(true); setAccountPage(true)
    } catch { setError('No se completó el registro. Comprueba tu conexión y vuelve a intentarlo.') }
    finally { setBusy(false) }
  }
  if (entered) return <>{children}</>
  if (accountPage) return <main className="mx-auto min-h-dvh max-w-[430px] bg-arsen-bg text-arsen-ink"><Suspense fallback={<p role="status">Preparando acceso…</p>}><AccountPage onContinue={enter} onBack={() => { setRegistered(false); setAccountPage(false) }} offerRestoreOnLoad={registered} /></Suspense></main>
  return <main className="relative isolate min-h-dvh overflow-hidden bg-arsen-bg text-arsen-ink"><div aria-hidden="true" className="access-atmosphere" /><div className="relative mx-auto flex min-h-dvh max-w-[430px] flex-col px-7 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))]"><header className="flex items-center gap-3"><img src={logo} alt="TKH" className="h-12 w-12 object-contain" /><span className="text-sm font-black tracking-[0.22em]">ARSEN</span></header><div aria-hidden="true" className="my-8 min-h-36 flex-1" /><div className="pb-5"><p className="text-xs font-bold uppercase tracking-[0.2em] text-arsen-purple2">Tu espacio de entrenamiento</p><h1 className="mt-3 text-4xl font-black leading-tight">Tu entrenamiento empieza aquí.</h1><p className="mt-3 text-sm leading-6 text-arsen-muted">Elige cómo continuar. Tus datos locales permanecen en este dispositivo.</p></div><div className="space-y-3"><button disabled={busy} onClick={() => setAccountPage(true)} className="min-h-12 w-full rounded-xl bg-arsen-purple2 px-4 font-bold text-arsen-bg disabled:opacity-50">Iniciar sesión</button><button disabled={busy} onClick={() => void register()} className="min-h-12 w-full rounded-xl border border-arsen-purple/60 px-4 font-semibold disabled:opacity-50">Crear cuenta</button><button disabled={busy} onClick={enter} className="min-h-12 w-full rounded-xl border border-white/20 px-4 font-semibold disabled:opacity-50">Continuar como invitado</button>{error && <p role="alert" className="text-sm leading-6 text-arsen-purple2">{error}</p>}</div></div></main>
}
