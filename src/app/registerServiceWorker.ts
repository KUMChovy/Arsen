export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline still works through IndexedDB; SW registration can fail in private mode.
    })
  })
}
