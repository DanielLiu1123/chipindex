import { describe, expect, it, vi } from 'vitest'
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { NextRequest } from 'next/server'
import { config, proxy } from '../proxy'

vi.mock('./auth', () => ({ AUTH_COOKIE: 'chipindex_auth', generateToken: async () => 'valid-token' }))

describe('public login logo', () => {
  it.each(['/icon.svg', '/icon.svg?version=1'])('serves %s without authentication interception', url => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false)
  })

  it.each(['/login', '/', '/groups/g1/sessions', '/icon.svg/private'])('retains authentication handling for %s', url => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true)
  })

  it('still redirects unauthenticated page requests to login', async () => {
    const response = await proxy(new NextRequest('https://chipindex.test/groups/g1/sessions'))
    expect(response.headers.get('location')).toBe('https://chipindex.test/login?next=%2Fgroups%2Fg1%2Fsessions')
  })
})
