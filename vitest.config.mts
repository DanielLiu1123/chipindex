import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname) },
  },
  test: {
    setupFiles: ['./lib/test-browser-setup.ts'],
    include: ['lib/**/*.test.ts', 'lib/**/*.test.tsx'],
  },
})
