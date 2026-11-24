import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const adminRoot = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(adminRoot, '..')

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, '')
  const key = env.CLERK_PUBLISHABLE_KEY ?? ''
  if (key && (key.length > 512 || !/^pk_(test|live)_[A-Za-z0-9+/=_-]+$/.test(key))) throw new Error('La clave pública de Clerk no es válida')
  return {
    root: adminRoot,
    envDir: projectRoot,
    publicDir: false,
    plugins: [react(), tailwindcss()],
    define: {
      __ARSEN_ADMIN_CLERK_KEY__: JSON.stringify(key),
      __ARSEN_ADMIN_API_ORIGIN__: JSON.stringify(env.ADMIN_API_ORIGIN ?? ''),
    },
    build: { outDir: resolve(projectRoot, 'dist-admin'), emptyOutDir: true },
  }
})
