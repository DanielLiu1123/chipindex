import { readFileSync } from 'node:fs'
import { transformSync } from 'esbuild'
import { createElement, type ReactNode } from 'react'
import * as React from 'react'
import * as ReactJsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

type NavComponent = () => ReactNode

function loadNav(pathname: string): NavComponent {
  const source = readFileSync(new URL('../components/Nav.tsx', import.meta.url), 'utf8')
  const output = transformSync(source, {
    format: 'cjs',
    jsx: 'automatic',
    loader: 'tsx',
    target: 'es2020',
  }).code
  const module = { exports: {} as Record<string, unknown> }
  const mocks: Record<string, unknown> = {
    react: React,
    'react/jsx-runtime': ReactJsxRuntime,
    'next/link': {
      __esModule: true,
      default: ({ children, ...props }: { children: ReactNode }) => createElement('a', props, children),
    },
    'next/image': {
      __esModule: true,
      default: () => createElement('span'),
    },
    'next/navigation': {
      usePathname: () => pathname,
      useRouter: () => ({ push: () => undefined }),
    },
    '@/lib/client': {
      listGroups: async () => [],
      logout: async () => undefined,
    },
    '@/lib/navigation': {
      isActivePath: (current: string, href: string, descendants = false) =>
        current === href || (descendants && current.startsWith(`${href}/`)),
    },
    '@/lib/session-pagination': {
      DEFAULT_SESSION_PAGE_SIZE: 10,
      sessionPageHref: (path: string) => `${path}?page=1&page_size=10`,
    },
    '@/lib/domain-types': {},
  }
  const requireMock = (specifier: string) => {
    if (!(specifier in mocks)) throw new Error(`Unexpected import: ${specifier}`)
    return mocks[specifier]
  }

  Function('require', 'module', 'exports', output)(requireMock, module, module.exports)
  return module.exports.default as NavComponent
}

describe('Nav rendering', () => {
  it('waits for a group pathname before rendering group navigation', () => {
    const html = renderToStaticMarkup(createElement(loadNav('/')))

    expect(html).not.toContain('LEADERBOARD')
    expect(html).not.toContain('SESSIONS')
    expect(html).not.toContain('MANAGE')
    expect(html).toContain('EXIT')
  })

  it('renders all group navigation items together', () => {
    const html = renderToStaticMarkup(createElement(loadNav('/groups/g1')))

    expect(html).toContain('LEADERBOARD')
    expect(html).toContain('SESSIONS')
    expect(html).toContain('MANAGE')
  })
})
