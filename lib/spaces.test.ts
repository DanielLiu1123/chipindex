import { describe, it, expect } from 'vitest'
import { parseSpaces, spaceForPassword, makeCookie, verifySpaceCookie } from './spaces'

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

describe('cookie sign/verify', () => {
  const spaces = parseSpaces('游戏A:pa,游戏B:pb')

  it('round-trips a valid cookie back to its space name', async () => {
    const cookie = await makeCookie('游戏A', 'pa')
    expect(await verifySpaceCookie(cookie, spaces)).toBe('游戏A')
  })

  it('rejects a tampered signature', async () => {
    const cookie = await makeCookie('游戏A', 'pa')
    const tampered = cookie.slice(0, -1) + (cookie.endsWith('0') ? '1' : '0')
    expect(await verifySpaceCookie(tampered, spaces)).toBeNull()
  })

  it('rejects a cookie whose space is no longer configured', async () => {
    const cookie = await makeCookie('游戏C', 'pc') // not in spaces
    expect(await verifySpaceCookie(cookie, spaces)).toBeNull()
  })

  it('rejects a cookie signed with the wrong password', async () => {
    const cookie = await makeCookie('游戏A', 'WRONG')
    expect(await verifySpaceCookie(cookie, spaces)).toBeNull()
  })

  it('returns null for undefined/garbage input', async () => {
    expect(await verifySpaceCookie(undefined, spaces)).toBeNull()
    expect(await verifySpaceCookie('garbage', spaces)).toBeNull()
  })
})
