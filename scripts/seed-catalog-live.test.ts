import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { loadEnv } from 'vite'
import { describe, expect, it } from 'vitest'
import { createAdminApi } from '../src/admin/api'
import { seedCatalog } from '../src/admin/seedCatalog'

describe.skipIf(process.env.RUN_CATALOG_SEED !== '1')('authorized development catalog seed', () => {
  it('uploads and publishes only the prepared development catalog', async () => {
    const env = loadEnv('development', process.cwd(), '')
    const secret = env.CLERK_SECRET_KEY
    const origin = env.ARSEN_BACKUP_API_ORIGIN
    if (!secret || !origin) throw new Error('Falta configuración de desarrollo')
    const headers = { authorization: `Bearer ${secret}` }
    const options = { headers, redirect: 'error' as const, signal: AbortSignal.timeout(10000) }
    const [instanceResponse, usersResponse] = await Promise.all([
      fetch('https://api.clerk.com/v1/instance', options), fetch('https://api.clerk.com/v1/users?limit=2', options),
    ])
    if (!instanceResponse.ok || !usersResponse.ok) throw new Error('No se pudo verificar la instancia de desarrollo')
    const instance = await instanceResponse.json()
    const usersBody = await usersResponse.json()
    const users = Array.isArray(usersBody) ? usersBody : usersBody.data
    if (instance.environment_type !== 'development' || !Array.isArray(users) || users.length !== 1) throw new Error('Se requiere una instancia aislada de desarrollo')
    const params = new URLSearchParams({ status: 'active', limit: '2', user_id: users[0].id })
    const sessionsResponse = await fetch(`https://api.clerk.com/v1/sessions?${params}`, options)
    if (!sessionsResponse.ok) throw new Error('No hay sesión de desarrollo disponible')
    const sessionsBody = await sessionsResponse.json()
    const sessions = Array.isArray(sessionsBody) ? sessionsBody : sessionsBody.data
    if (!Array.isArray(sessions) || sessions.length < 1 || !/^sess_[A-Za-z0-9]+$/.test(sessions[0].id)) throw new Error('No hay sesión activa')
    const getToken = async () => {
      const response = await fetch(`https://api.clerk.com/v1/sessions/${sessions[0].id}/tokens`, {
        method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{}', redirect: 'error', signal: AbortSignal.timeout(10000),
      })
      if (!response.ok) throw new Error('No se pudo renovar la sesión de desarrollo')
      return (await response.json()).jwt as string
    }
    const inventory = JSON.parse(await readFile('generated/arsen-catalog-seed-inventory.json', 'utf8')) as { format: number; exercises: Array<{ image: { localPath: string } }> }
    if (inventory.format !== 1 || inventory.exercises.length !== 74) throw new Error('Inventario inválido')
    const files: File[] = []
    for (const item of inventory.exercises) {
      const path = item.image.localPath
      if (!/^src\/assets\/ejercicios\/[a-z0-9-]+--(?:pecho|espalda|hombros|brazos|abdomen|piernas)\.png$/.test(path)) throw new Error('Ruta de imagen inválida')
      const bytes = await readFile(path)
      files.push(new File([new Uint8Array(bytes)], basename(path), { type: 'image/png' }))
    }
    const result = await seedCatalog(createAdminApi(new URL(origin).origin, getToken), inventory.exercises, files, undefined,
      (done, total) => { if (done % 10 === 0 || done === total) console.log(`Catálogo: ${done}/${total}`) })
    expect(result.published + result.skipped).toBe(74)
    console.log(`Publicados: ${result.published}; existentes conservados: ${result.skipped}.`)
  }, 20 * 60 * 1000)
})
