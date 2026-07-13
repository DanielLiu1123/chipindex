import { describe, it, expect } from 'vitest'
import { parseSpaces, spaceForPassword } from './spaces'

describe('parseSpaces', () => {
  it('parses multiple space:password pairs', () => {
    const m = parseSpaces('游戏A:pa,游戏B:pb')
    expect(m.get('游戏A')).toBe('pa')
    expect(m.get('游戏B')).toBe('pb')
    expect(m.size).toBe(2)
  })
  it('returns empty map for undefined/empty', () => {
    expect(parseSpaces(undefined).size).toBe(0)
    expect(parseSpaces('').size).toBe(0)
  })
  it('skips malformed entries (no colon, empty name/password)', () => {
    const m = parseSpaces('good:pw,nocolon,:nopw,noname:')
    expect(m.size).toBe(1)
    expect(m.get('good')).toBe('pw')
  })
})

describe('spaceForPassword', () => {
  const spaces = parseSpaces('游戏A:pa,游戏B:pb')
  it('returns the space name whose password matches', () => {
    expect(spaceForPassword('pa', spaces)).toBe('游戏A')
    expect(spaceForPassword('pb', spaces)).toBe('游戏B')
  })
  it('returns null for unknown or empty password', () => {
    expect(spaceForPassword('nope', spaces)).toBeNull()
    expect(spaceForPassword('', spaces)).toBeNull()
  })
})
