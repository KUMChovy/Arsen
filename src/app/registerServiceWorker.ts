import { Capacitor } from '@capacitor/core'

export type ServiceWorkerRegistrationEnvironment = {
  hasServiceWorker: boolean
  isDev: boolean
  isNative: boolean
}

export function shouldRegisterServiceWorker({ hasServiceWorker, isDev, isNative }: ServiceWorkerRegistrationEnvironment) {
  return hasServiceWorker && !isDev && !isNative
}

export function registerServiceWorker() {
  if (
    !shouldRegisterServiceWorker({
      hasServiceWorker: 'serviceWorker' in navigator,
      isDev: import.meta.env.DEV,
      isNative: Capacitor.isNativePlatform(),
    })
  )
    return

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline still works through IndexedDB; SW registration can fail in private mode.
    })
  })
}
