import { renderToReadableStream } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import Page from '../app/groups/[groupId]/sessions/(list)/page'

vi.mock('./queries', () => ({
  getGroup: async () => ({ id: 'g1', name: 'Group' }),
  getSessionsPage: async (_groupId: string, requestedPage: number, pageSize: number) => ({
    sessions: [],
    page: Math.min(requestedPage, 3),
    page_size: pageSize,
    total: 25,
    total_pages: 3,
  }),
}))
vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('404') },
  redirect: (url: string) => { throw new Error(`redirect:${url}`) },
}))

async function renderPage(query: { page?: string; page_size?: string }) {
  let renderError: unknown
  const stream = await renderToReadableStream(await Page({
    params: Promise.resolve({ groupId: 'g1' }),
    searchParams: Promise.resolve(query),
  }), { onError: error => { renderError = error } })
  await stream.allReady
  if (renderError) throw renderError
  return new Response(stream).text()
}

describe('Sessions navigation pagination', () => {
  it('renders a bare return link without redirecting to default parameters', async () => {
    const html = await renderPage({})
    expect(html).toContain('25')
    expect(html).toContain('/groups/g1/sessions?page=2&amp;page_size=10')
  })

  it('accepts partially specified pagination', async () => {
    expect(await renderPage({ page: '2' })).toContain('/groups/g1/sessions?page=3&amp;page_size=10')
    expect(await renderPage({ page_size: '5' })).toContain('/groups/g1/sessions?page=2&amp;page_size=5')
  })

  it.each([
    [{ page: '-1' }, 'page=1&page_size=10'],
    [{ page: '99' }, 'page=3&page_size=10'],
    [{ page_size: '500' }, 'page=1&page_size=100'],
  ])('still corrects invalid or out-of-range parameters: %j', async (query, canonical) => {
    await expect(renderPage(query)).rejects.toThrow(`redirect:/groups/g1/sessions?${canonical}`)
  })
})
