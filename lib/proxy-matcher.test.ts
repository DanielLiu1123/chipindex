import { expect, it } from 'vitest'
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import { config } from '../proxy'

it('serves the brand icon before login without excluding protected routes', () => {
  const matches = (url: string) => unstable_doesMiddlewareMatch({ config, nextConfig: {}, url })
  expect(matches('/icon.svg')).toBe(false)
  expect(matches('/icon.svg?v=brand')).toBe(false)
  for (const url of ['/', '/groups/new', '/groups/g1', '/icon.svg/private', '/iconXsvg']) {
    expect(matches(url)).toBe(true)
  }
})
