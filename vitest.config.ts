import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  oxc: {
    jsx: {
      runtime: 'automatic',
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname) },
  },
  test: {
    include: ['lib/**/*.test.ts'],
  },
})
