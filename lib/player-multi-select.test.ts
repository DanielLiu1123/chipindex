import { readFileSync } from 'node:fs'
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import * as ReactJsxRuntime from 'react/jsx-runtime'
import ts from 'typescript'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Player } from '@/types'

type StateUpdater<T> = T | ((previous: T) => T)
type Props = { players: Player[]; excludedIds: string[]; onAdd: (ids: string[]) => void; onNew?: () => void }
type Component = (props: Props) => ReactNode
type HostProps = { children?: ReactNode; onClick?: () => void; disabled?: boolean }

const hookStates: unknown[] = []
let hookCursor = 0

function useStateHarness<T>(initial: T): [T, (next: StateUpdater<T>) => void] {
  const index = hookCursor++
  if (index >= hookStates.length) hookStates[index] = initial
  return [hookStates[index] as T, next => {
    const previous = hookStates[index] as T
    hookStates[index] = typeof next === 'function' ? (next as (value: T) => T)(previous) : next
  }]
}

function loadComponent(): Component {
  const source = readFileSync(new URL('../components/PlayerMultiSelect.tsx', import.meta.url), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const module = { exports: {} as Record<string, unknown> }
  const mocks: Record<string, unknown> = {
    react: { useState: useStateHarness, useRef: () => ({ current: null }), useEffect: () => undefined },
    'react/jsx-runtime': ReactJsxRuntime,
  }
  Function('require', 'module', 'exports', output)((name: string) => mocks[name], module, module.exports)
  return module.exports.default as Component
}

function text(node: ReactNode): string {
  let value = ''
  Children.forEach(node, child => {
    if (typeof child === 'string' || typeof child === 'number') value += child
    else if (isValidElement<HostProps>(child)) value += text(child.props.children)
  })
  return value
}

function buttons(node: ReactNode): ReactElement<HostProps, string>[] {
  const found: ReactElement<HostProps, string>[] = []
  Children.forEach(node, child => {
    if (!isValidElement<HostProps>(child)) return
    if (child.type === 'button') found.push(child as ReactElement<HostProps, string>)
    found.push(...buttons(child.props.children))
  })
  return found
}

function click(node: ReactNode, label: string) {
  const button = buttons(node).find(item => text(item.props.children) === label)
  if (!button?.props.onClick) throw new Error(`Missing button: ${label}`)
  button.props.onClick()
}

const players: Player[] = [
  { id: 'alice', name: 'Alice', created_at: '' },
  { id: 'bob', name: 'Bob', created_at: '' },
  { id: 'carol', name: 'Carol', created_at: '' },
]

beforeEach(() => {
  hookStates.length = 0
  hookCursor = 0
})

describe('PlayerMultiSelect', () => {
  it('confirms multiple checked players in list order', () => {
    const added: string[][] = []
    const Component = loadComponent()
    const props: Props = { players, excludedIds: ['carol'], onAdd: ids => added.push(ids), onNew: () => undefined }
    const render = () => { hookCursor = 0; return Component(props) }

    click(render(), 'SELECT PLAYERS')
    click(render(), 'Bob')
    click(render(), 'Alice')
    click(render(), 'ADD 2 PLAYERS')

    expect(added).toEqual([['alice', 'bob']])
  })

  it('hides the new-player action when onNew is omitted', () => {
    const Component = loadComponent()
    const props: Props = { players, excludedIds: [], onAdd: () => undefined }
    const render = () => { hookCursor = 0; return Component(props) }

    click(render(), 'SELECT PLAYERS')

    expect(buttons(render()).map(button => text(button.props.children))).not.toContain('+ NEW PLAYER')
  })
})
