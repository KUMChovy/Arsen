const checkIntervalMs = 15 * 60 * 1000
const catalogOpenEvent = 'arsen:catalog-open'

export function requestCatalogCheck() {
  window.dispatchEvent(new Event(catalogOpenEvent))
}

export function startCatalogScheduler(sync: () => Promise<unknown>) {
  let lastAttempt = -Infinity
  let running = false
  let retryOnFinish = false
  let stopped = false

  function check(force = false) {
    if (stopped) return
    if (running) { if (force) retryOnFinish = true; return }
    const elapsed = Date.now() - lastAttempt
    if (!force && elapsed >= 0 && elapsed < checkIntervalMs) return
    lastAttempt = Date.now()
    running = true
    void Promise.resolve().then(sync).catch(() => undefined).finally(() => {
      running = false
      if (retryOnFinish && !stopped) { retryOnFinish = false; check(true) }
    })
  }

  const onOnline = () => check(true)
  const onCatalogOpen = () => check()
  const onVisibility = () => { if (document.visibilityState === 'visible') check() }
  window.addEventListener('online', onOnline)
  window.addEventListener(catalogOpenEvent, onCatalogOpen)
  document.addEventListener('visibilitychange', onVisibility)
  check()
  return {
    check: () => check(),
    stop: () => {
      stopped = true
      window.removeEventListener('online', onOnline)
      window.removeEventListener(catalogOpenEvent, onCatalogOpen)
      document.removeEventListener('visibilitychange', onVisibility)
    },
  }
}
