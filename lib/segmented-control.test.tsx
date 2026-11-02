// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SegmentedControl } from '../components/ui/segmented-control'

afterEach(cleanup)

function Example() {
  const [value, setValue] = useState<'table' | 'chart'>('table')
  return <SegmentedControl value={value} onValueChange={setValue} label="View" options={[
    { value: 'table', label: 'Table' }, { value: 'chart', label: 'Chart' },
  ]} />
}

it('keeps exactly one option selected and supports keyboard selection', async () => {
  const user = userEvent.setup()
  render(<Example />)
  const table = screen.getByRole('radio', { name: 'Table' })
  const chart = screen.getByRole('radio', { name: 'Chart' })
  await user.click(table)
  expect(table.getAttribute('aria-checked')).toBe('true')
  await user.keyboard('{ArrowRight}')
  expect(document.activeElement).toBe(chart)
  expect(chart.getAttribute('aria-checked')).toBe('true')
  expect(table.getAttribute('aria-checked')).toBe('false')
  await user.click(chart)
  expect(chart.getAttribute('aria-checked')).toBe('true')
  await user.keyboard('{ArrowRight}')
  expect(table.getAttribute('aria-checked')).toBe('true')
})
