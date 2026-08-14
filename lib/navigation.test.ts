import { describe, expect, it } from 'vitest'

import { isActivePath } from './navigation'

describe('isActivePath', () => {
  it('marks group settings as active for the MANAGE tab', () => {
    expect(isActivePath('/groups/g1/settings', '/groups/g1/settings', true)).toBe(true)
  })

  it('does not mark MANAGE active on another group page', () => {
    expect(isActivePath('/groups/g1/sessions', '/groups/g1/settings', true)).toBe(false)
  })
})
