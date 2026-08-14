import { describe, expect, it } from 'vitest'

import {
  normalizeSessionPageParam,
  sessionPageHref,
} from './session-pagination'

describe('session pagination parameters', () => {
  it('keeps a custom page size while navigating between pages', () => {
    expect(sessionPageHref('/groups/g1/sessions', 3, 25))
      .toBe('/groups/g1/sessions?page=3&page_size=25')
  })

  it('normalizes invalid and excessive numeric input', () => {
    expect(normalizeSessionPageParam('invalid', 1)).toBe(1)
    expect(normalizeSessionPageParam('-2', 10, 100)).toBe(10)
    expect(normalizeSessionPageParam('500', 10, 100)).toBe(100)
  })
})
