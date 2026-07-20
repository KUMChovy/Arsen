import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join, relative, sep } from 'node:path'

const distDir = 'dist'
const cachedExtensions = new Set(['.css', '.html', '.js', '.json', '.png', '.svg', '.webmanifest'])
const files = await listDistFiles(distDir)
const assets = files
  .filter((file) => file !== 'sw.js' && cachedExtensions.has(extname(file)))
  .map((file) => `/${file.split(sep).join('/')}`)
  .sort()
const versionHash = createHash('sha256').update(assets.join('\n')).digest('hex').slice(0, 12)

await writeFile(
  join(distDir, 'sw.js'),
  `const CACHE_VERSION = 'arsen-${versionHash}'
const APP_SHELL = ${JSON.stringify(['/', ...assets], null, 2)}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, '/index.html'))
    return
  }

  event.respondWith(cacheFirst(request))
})

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION)
  const cached = await cache.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (response.ok) {
    cache.put(request, response.clone())
  }

  return response
}

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE_VERSION)

  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return (await cache.match(request)) ?? (await cache.match(fallbackUrl))
  }
}
`,
)

async function listDistFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const found = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) return listDistFiles(fullPath)

      return relative(distDir, fullPath)
    }),
  )

  return found.flat()
}
