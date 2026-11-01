import { describe, expect, it } from 'vitest'
import { shouldRegisterServiceWorker } from './registerServiceWorker'

describe('shouldRegisterServiceWorker', () => {
  it('skips registration inside the native Capacitor WebView', () => {
    expect(
      shouldRegisterServiceWorker({ hasServiceWorker: true, isDev: false, isNative: true }),
    ).toBe(false)
  })

  it('registers in a production browser with service-worker support', () => {
    expect(
      shouldRegisterServiceWorker({ hasServiceWorker: true, isDev: false, isNative: false }),
    ).toBe(true)
  })

  it('skips registration during development', () => {
    expect(
      shouldRegisterServiceWorker({ hasServiceWorker: true, isDev: true, isNative: false }),
    ).toBe(false)
  })

  it('skips registration when the browser has no service-worker support', () => {
    expect(
      shouldRegisterServiceWorker({ hasServiceWorker: false, isDev: false, isNative: false }),
    ).toBe(false)
  })
})
