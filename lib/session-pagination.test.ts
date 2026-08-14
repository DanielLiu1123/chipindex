import { describe, expect, it } from 'vitest'

import {
  getSessionPaginationItems,
  hasCanonicalSessionPageParams,
  normalizeSessionPageParam,
  sessionPageHref,
} from './session-pagination'

describe('session pagination parameters', () => {
  it('centers a long pagination range around the current page', () => {
    expect(getSessionPaginationItems(6, 20)).toEqual([
      1,
      'ellipsis',
      4,
      5,
      6,
      7,
      8,
      'ellipsis',
      20,
    ])
  })

  it('shows every page when the total is seven or fewer', () => {
    expect(getSessionPaginationItems(1, 6)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('keeps a custom page size while navigating between pages', () => {
    expect(sessionPageHref('/groups/g1/sessions', 3, 25))
      .toBe('/groups/g1/sessions?page=3&page_size=25')
  })

  it('always includes the default page and page size', () => {
    expect(sessionPageHref('/groups/g1/sessions', 1, 10))
      .toBe('/groups/g1/sessions?page=1&page_size=10')
  })

  it('requires both canonical query parameters', () => {
    expect(hasCanonicalSessionPageParams(undefined, undefined, 1, 10)).toBe(false)
    expect(hasCanonicalSessionPageParams('1', '10', 1, 10)).toBe(true)
  })

  it('normalizes invalid and excessive numeric input', () => {
    expect(normalizeSessionPageParam('invalid', 1)).toBe(1)
    expect(normalizeSessionPageParam('-2', 10, 100)).toBe(10)
    expect(normalizeSessionPageParam('500', 10, 100)).toBe(100)
  })
})
