// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
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

it('renders one shared range with page four directly reachable from page three', () => {
  const onPageChange = vi.fn()
  render(<SessionPagination {...props} page={3} totalPages={20} onPageChange={onPageChange} />)
  expect(screen.getAllByRole('link', { name: /^Go to page / })).toHaveLength(7)
  fireEvent.click(screen.getByRole('link', { name: 'Go to page 4' }))
  expect(onPageChange).toHaveBeenCalledWith('/groups/g/sessions?page=4&page_size=10')
})

it('falls back to three interior pages and restores five when the preferred row fits', () => {
  let availableWidth = 288
  let preferredWidth = 310
  let resize = () => {}
  const OriginalObserver = globalThis.ResizeObserver
  globalThis.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) { resize = () => callback([], this) }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  const measure = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return { width: this.classList.contains('w-max') ? preferredWidth : availableWidth } as DOMRect
  })
  try {
    const { rerender } = render(<SessionPagination {...props} page={500} totalPages={1000} onPageChange={() => {}} />)
    const pages = () => screen.getAllByRole('link', { name: /^Go to page / }).map(link => link.textContent)
    expect(pages()).toEqual(['1', '499', '500', '501', '1000'])
    availableWidth = 400
    act(() => resize())
    expect(pages()).toEqual(['1', '498', '499', '500', '501', '502', '1000'])
    availableWidth = 288
    act(() => resize())
    expect(pages()).toHaveLength(5)
    preferredWidth = 260
    rerender(<SessionPagination {...props} page={3} totalPages={1000} onPageChange={() => {}} />)
    expect(pages()).toEqual(['1', '2', '3', '4', '5', '6', '1000'])
  } finally {
    cleanup()
    measure.mockRestore()
    globalThis.ResizeObserver = OriginalObserver
  }
})
