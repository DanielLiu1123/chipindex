// Lightweight render harness for handler/state tests (not browser/layout tests).
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { transformSync } from 'esbuild'
import * as jsx from 'react/jsx-runtime'

const root = fileURLToPath(new URL('../', import.meta.url))

export function createHookHarness() {
  const states: unknown[] = []
  let cursor = 0
  function useState<T>(initial: T | (() => T)): [T, (next: T | ((prev: T) => T)) => void] {
    const index = cursor++
    if (index >= states.length) states[index] = typeof initial === 'function' ? (initial as () => T)() : initial
    return [states[index] as T, next => {
      states[index] = typeof next === 'function' ? (next as (prev: T) => T)(states[index] as T) : next
    }]
  }
  return {
    react: { useState, useRef: <T>(initial: T) => useState({ current: initial })[0],
      useId: () => useState(() => `test-${cursor}`)[0], useEffect: () => undefined,
      useMemo: <T>(factory: () => T) => factory() },
    render: <T>(fn: () => T): T => { cursor = 0; return fn() },
    reset: () => { states.length = 0; cursor = 0 },
  }
}

// Load real local dependencies while replacing only the external seams. This
// avoids duplicating application hooks/validation in each component test.
export function loadUiModule<T>(url: URL, mocks: Record<string, unknown>): T {
  const cache = new Map<string, { exports: unknown }>()
  const normalize = (name: string, parent: string) => name.startsWith('@/') ? resolve(root, name.slice(2))
    : name.startsWith('.') ? resolve(dirname(parent), name) : name
  const replacements = new Map(Object.entries({ 'react/jsx-runtime': jsx, ...mocks }).map(([key, value]) => [normalize(key, root), value]))
  function load(path: string): unknown {
    if (replacements.has(path)) return replacements.get(path)
    const file = [path, `${path}.ts`, `${path}.tsx`].find(candidate => existsSync(candidate))
    if (!file) throw new Error(`Missing test adapter: ${path}`)
    const cached = cache.get(file)
    if (cached) return cached.exports
    const module = { exports: {} }
    cache.set(file, module)
    const code = transformSync(readFileSync(file, 'utf8'), { format: 'cjs', jsx: 'automatic', loader: 'tsx' }).code
    Function('require', 'module', 'exports', code)((name: string) => load(normalize(name, file)), module, module.exports)
    return module.exports
  }
  return load(fileURLToPath(url)) as T
}
