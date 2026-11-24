export type AdminClerk = {
  load(options: { ui: { ClerkUI: unknown } }): Promise<void>
  session: { id: string; getToken(): Promise<string | null> } | null
  openSignIn(): void | Promise<void>
  signOut(): Promise<void>
  addListener(listener: () => void): () => void
}

type Dependencies = {
  loadScript: (url: string, key?: string) => Promise<void>
  getSdk: () => AdminClerk | null
  getUi: () => unknown
}

function script(url: string, key?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const element = document.createElement('script')
    const timer = setTimeout(() => { element.remove(); reject(new Error('No se pudo cargar el acceso')) }, 15_000)
    element.async = true
    element.crossOrigin = 'anonymous'
    element.src = url
    if (key) element.dataset.clerkPublishableKey = key
    element.onload = () => { clearTimeout(timer); resolve() }
    element.onerror = () => { clearTimeout(timer); element.remove(); reject(new Error('No se pudo cargar el acceso')) }
    document.head.appendChild(element)
  })
}

export async function loadAdminClerk(key: string, dependencies: Dependencies = {
  loadScript: script,
  getSdk: () => (window as Window & { Clerk?: AdminClerk }).Clerk ?? null,
  getUi: () => (window as Window & { __internal_ClerkUICtor?: unknown }).__internal_ClerkUICtor,
}): Promise<AdminClerk> {
  if (key.length > 512 || !/^pk_(test|live)_[A-Za-z0-9+/=_-]+$/.test(key)) throw new Error('Clave pública de Clerk inválida')
  let decoded: string
  try { decoded = atob(key.slice(key.indexOf('_', 3) + 1).replace(/-/g, '+').replace(/_/g, '/')) } catch { throw new Error('Clave pública de Clerk inválida') }
  if (!decoded.endsWith('$')) throw new Error('Clave pública de Clerk inválida')
  const domain = decoded.slice(0, -1)
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain) || (key.startsWith('pk_test_') && !domain.endsWith('.clerk.accounts.dev'))) throw new Error('Dominio de Clerk inválido')
  await dependencies.loadScript(`https://${domain}/npm/@clerk/ui@1/dist/ui.browser.js`, undefined)
  await dependencies.loadScript(`https://${domain}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`, key)
  const sdk = dependencies.getSdk()
  const ui = dependencies.getUi()
  if (!sdk || !ui) throw new Error('No se pudo cargar el acceso')
  await sdk.load({ ui: { ClerkUI: ui } })
  return sdk
}
