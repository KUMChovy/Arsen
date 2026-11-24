import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    ssr: resolve('api/gateway.ts'),
    outDir: resolve('api'),
    emptyOutDir: false,
    rollupOptions: { output: { entryFileNames: 'gateway.mjs' } },
  },
})
