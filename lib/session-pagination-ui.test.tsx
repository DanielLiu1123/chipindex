// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import SessionPagination from '../components/SessionPagination'
import PaginatedSessions from '../components/PaginatedSessions'
const push = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
afterEach(() => { cleanup(); push.mockClear() })
const props = { sessionsPath: '/groups/g/sessions', page: 1, pageSize: 10, totalPages: 9 }
it('uses client navigation for page clicks and GO without scrolling the page', () => {
  render(<PaginatedSessions {...props}><div>Sessions table</div></PaginatedSessions>)
  fireEvent.click(screen.getByRole('link', { name: 'Next page' }))
  expect(push).toHaveBeenLastCalledWith('/groups/g/sessions?page=2&page_size=10', { scroll: false })
  const input = screen.getByRole('spinbutton', { name: 'Go to page' })
  fireEvent.change(input, { target: { value: '5' } })
  fireEvent.submit(input.closest('form')!)
  expect(push).toHaveBeenLastCalledWith('/groups/g/sessions?page=5&page_size=10', { scroll: false })
})
it('preserves custom navigation and modified link clicks', () => {
  const onPageChange = vi.fn()
  render(<SessionPagination {...props} onPageChange={onPageChange} />)
  const link = screen.getByRole('link', { name: 'Next page' })
  fireEvent.click(link, { ctrlKey: true })
  expect(onPageChange).not.toHaveBeenCalled()
  fireEvent.click(link)
  expect(onPageChange).toHaveBeenCalledWith('/groups/g/sessions?page=2&page_size=10')
  expect(push).not.toHaveBeenCalled()
})
