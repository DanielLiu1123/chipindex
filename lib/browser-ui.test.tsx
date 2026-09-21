// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import ConfirmModal from '../components/ConfirmModal'
import EditSessionForm from '../components/EditSessionForm'
import SessionForm from '../components/SessionForm'
import NewSessionForm from '../components/NewSessionForm'
import BrowserTime from '../components/BrowserTime'
import LeaderboardView from '../components/LeaderboardView'
import Nav from '../components/Nav'
import PlayerNameEditor from '../components/PlayerNameEditor'
import DeleteSessionButton from '../components/DeleteSessionButton'
import type { Player, SessionForEdit } from './domain-types'
import { localDate, localTime } from './browser-time'

const client = vi.hoisted(() => ({ updateSession: vi.fn(), importSession: vi.fn(), createPlayerInGroup: vi.fn(),
  startSession: vi.fn(), listGroups: vi.fn(), logout: vi.fn(), renamePlayer: vi.fn(), deleteSession: vi.fn(), push: vi.fn(), refresh: vi.fn() }))
vi.mock('./client', async importOriginal => ({ ...await importOriginal<typeof import('./client')>(), ...client }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: client.push, refresh: client.refresh }), usePathname: () => '/groups/g1' }))
vi.mock('next/link', () => ({ default: ({ children, ...props }: { children: ReactNode }) => createElement('a', props, children) }))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('../components/LeaderboardChart', () => ({ default: (props: { data: unknown; mode: string }) => createElement('pre', { 'data-testid': 'leaderboard-chart' }, JSON.stringify(props)) }))

// jsdom has no top-layer implementation. Only these native platform methods
// are adapted; hooks, effects, DOM events and component rendering are real React.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
    this.querySelector<HTMLElement>('[autofocus], input, button')?.focus()
  }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
beforeEach(() => {
  Object.values(client).forEach(mock => mock.mockReset())
  client.listGroups.mockResolvedValue([])
})
afterEach(cleanup)
const players: Player[] = ['Alice', 'Bob', 'Carol'].map(name => ({ id: name, name, created_at: '2026-01-01', updated_at: '2026-01-01', deleted_at: null }))
const session: SessionForEdit = { date: '2026-09-05', ended_at: '2026-09-05T20:00:00Z', exchange_rate: 40,
  description: null, status: 'SETTLED', participants: [{ player_id: 'Alice', name: 'Alice', final_chips: 2000,
    buy_ins: [{ id: 'buyin-a', amount: 2000, created_at: '2026-09-05T18:00:00.123Z' }] }] }

async function addPlayers(names: string[]) {
  fireEvent.click(screen.getByRole('button', { name: '+ PLAYER' }))
  const dialog = screen.getByRole('dialog', { name: 'Add players' })
  names.forEach(name => fireEvent.click(within(dialog).getByRole('checkbox', { name })))
  fireEvent.click(within(dialog).getByRole('button', { name: 'ADD' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
}

describe('real React session forms', () => {
  it('preserves existing event IDs/timestamps, validates all players, and inserts only selected newcomers', async () => {
    render(<EditSessionForm groupId="g1" sessionId="s1" session={session} initialPlayers={players} />)
    await addPlayers(['Bob', 'Carol'])
    fireEvent.change(screen.getByLabelText('final chips for Bob'), { target: { value: '2000' } })
    fireEvent.click(screen.getByRole('button', { name: 'SAVE CHANGES' }))
    expect(client.updateSession).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('final chips for Carol'), { target: { value: '2000' } })
    client.updateSession.mockResolvedValue({ id: 's1' })
    fireEvent.click(screen.getByRole('button', { name: 'SAVE CHANGES' }))
    await waitFor(() => expect(client.push).toHaveBeenCalled())
    expect(client.updateSession.mock.calls[0][2].participants).toEqual([
      { player_id: 'Alice', final_chips: 2000, buy_ins: [{ id: 'buyin-a', amount: 2000, created_at: '2026-09-05T18:00:00.123Z' }] },
      ...['Bob', 'Carol'].map(player_id => ({ player_id, final_chips: 2000, buy_ins: [{ amount: 2000, created_at: '2026-09-05T20:00:00.000Z' }] })),
    ])
  })
  it('rejects a cleared existing buy-in instead of deleting it', async () => {
    render(<EditSessionForm groupId="g1" sessionId="s1" session={session} initialPlayers={players} />)
    fireEvent.click(screen.getByRole('button', { name: /Alice.*buy-in/ }))
    const numbers = screen.getAllByRole('spinbutton')
    const buyin = numbers.find(input => (input as HTMLInputElement).min === '1' && (input as HTMLInputElement).value === '2000')!
    fireEvent.change(buyin, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'SAVE CHANGES' }))
    expect(client.updateSession).not.toHaveBeenCalled()
    expect(screen.getByText(/Every buy-in needs/)).toBeTruthy()
  })
  it('imports every selected player and keeps newly created IDs after a failed import', async () => {
    render(<SessionForm groupId="g1" initialPlayers={players} />)
    fireEvent.click(screen.getByRole('button', { name: '+ PLAYER' }))
    fireEvent.click(screen.getByRole('button', { name: '+ NEW PLAYER' }))
    fireEvent.change(screen.getByLabelText('New player name'), { target: { value: 'Dave' } })
    client.createPlayerInGroup.mockResolvedValue({ player: { ...players[0], id: 'Dave', name: 'Dave' } })
    fireEvent.click(screen.getByRole('button', { name: 'CREATE' }))
    await screen.findByRole('checkbox', { name: 'Dave' })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Alice' }))
    fireEvent.click(screen.getByRole('button', { name: 'ADD' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.change(screen.getByLabelText('net chips for Dave'), { target: { value: '100' } })
    fireEvent.submit(screen.getByRole('button', { name: 'IMPORT' }).closest('form')!)
    expect(client.importSession).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('net chips for Alice'), { target: { value: '-100' } })
    client.importSession.mockRejectedValueOnce(new Error('Please retry.')).mockResolvedValueOnce({ id: 's1' })
    fireEvent.submit(screen.getByRole('button', { name: 'IMPORT' }).closest('form')!)
    await screen.findByText('Please retry.')
    fireEvent.submit(screen.getByRole('button', { name: 'IMPORT' }).closest('form')!)
    await waitFor(() => expect(client.push).toHaveBeenCalled())
    expect(client.createPlayerInGroup).toHaveBeenCalledTimes(1)
    expect(client.importSession.mock.calls[1][1].entries).toEqual(expect.arrayContaining([
      { player_id: 'Dave', chips: 100 }, { player_id: 'Alice', chips: -100 },
    ]))
  })
  it('initializes both new/import dates in the browser local zone', () => {
    const first = render(<NewSessionForm groupId="g1" initialPlayers={players} />)
    expect((first.container.querySelector('input[type=date]') as HTMLInputElement).value).toBe(localDate())
    first.unmount()
    const second = render(<SessionForm groupId="g1" initialPlayers={players} />)
    expect((second.container.querySelector('input[type=date]') as HTMLInputElement).value).toBe(localDate())
  })
})

describe('shared dialog and failures', () => {
  it('blocks duplicate confirms and Escape while pending; keeps errors visible and restores focus on close', async () => {
    const trigger = document.createElement('button'); document.body.appendChild(trigger); trigger.focus()
    let reject!: (reason: Error) => void
    const confirm = vi.fn(() => new Promise<void>((_, no) => { reject = no }))
    const cancel = vi.fn()
    const view = render(<ConfirmModal open title="Delete?" onConfirm={confirm} onCancel={cancel} />)
    const dialog = screen.getByRole('dialog', { name: 'Delete?' })
    await userEvent.click(screen.getByRole('button', { name: 'DELETE' }))
    await userEvent.click(screen.getByRole('button', { name: 'SAVING...' }))
    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }))
    expect(confirm).toHaveBeenCalledTimes(1); expect(cancel).not.toHaveBeenCalled()
    await act(async () => reject(new Error('Delete failed.')))
    expect(screen.getByRole('alert').textContent).toBe('Delete failed.')
    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }))
    expect(cancel).toHaveBeenCalledTimes(1)
    view.rerender(<ConfirmModal open={false} title="Delete?" onConfirm={confirm} onCancel={cancel} />)
    expect(document.activeElement).toBe(trigger); trigger.remove()
  })
  it('does not navigate when logout fails', async () => {
    render(<Nav />)
    client.logout.mockRejectedValue(new Error('Unable to connect.'))
    fireEvent.click(screen.getByRole('button', { name: 'EXIT' }))
    await screen.findByText('Unable to connect.')
    expect(client.push).not.toHaveBeenCalled()
  })
  it('keeps a failed deletion open and a failed rename editable with an error', async () => {
    client.deleteSession.mockRejectedValue(new Error('Delete unavailable.'))
    const view = render(<DeleteSessionButton groupId="g1" sessionId="s1" />)
    fireEvent.click(screen.getByRole('button', { name: 'DELETE' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'DELETE' }))
    await screen.findByText('Delete unavailable.')
    expect(client.refresh).not.toHaveBeenCalled()
    view.unmount()
    render(<PlayerNameEditor groupId="g1" id="Alice" initialName="Alice" />)
    fireEvent.click(screen.getByRole('button', { name: 'Alice' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Alicia' } })
    client.renamePlayer.mockRejectedValue(new Error('Rename unavailable.'))
    fireEvent.blur(screen.getByRole('textbox'))
    await screen.findByText('Rename unavailable.')
    expect(screen.getByRole('textbox')).toBeTruthy()
  })
})

it('hydrates local time without a server/browser mismatch', async () => {
  const value = '2026-08-01T00:30:00Z'
  const html = renderToString(<BrowserTime value={value} />)
  expect(html).toContain('>—</time>')
  const container = document.createElement('div'); container.innerHTML = html; document.body.appendChild(container)
  const error = vi.fn()
  let root!: ReturnType<typeof hydrateRoot>
  await act(async () => { root = hydrateRoot(container, <BrowserTime value={value} />, { onRecoverableError: error }) })
  expect(container.textContent).toBe(localTime(value)); expect(error).not.toHaveBeenCalled()
  await act(async () => root.unmount()); container.remove()
})

it('preserves sorting button identity and keyboard focus through a sort', () => {
  render(<LeaderboardView groupId="g1" players={players} sessions={[]} />)
  const button = screen.getByRole('button', { name: /^POG/ }); button.focus()
  fireEvent.click(button)
  expect(screen.getByRole('button', { name: /^POG/ })).toBe(button)
  expect(document.activeElement).toBe(button)
})


it('shares the date range between rankings and rebased CNY/chip curves, and validates custom dates', () => {
  const sessions = [
    { id: 'old', date: '2025-12-31', exchange_rate: 40, session_entries: [{ player_id: 'Alice', chips: 4000, final_chips: 6000, total_buyin: 2000, buy_in_count: 1 }] },
    { id: 'start', date: '2026-01-01', exchange_rate: 40, session_entries: [{ player_id: 'Alice', chips: 400, final_chips: 2400, total_buyin: 2000, buy_in_count: 1 }] },
    { id: 'end', date: '2026-01-31', exchange_rate: 20, session_entries: [{ player_id: 'Alice', chips: -100, final_chips: 1900, total_buyin: 2000, buy_in_count: 1 }] },
    { id: 'after', date: '2026-02-01', exchange_rate: 40, session_entries: [{ player_id: 'Bob', chips: 8000, final_chips: 10000, total_buyin: 2000, buy_in_count: 1 }] },
  ]
  render(<LeaderboardView groupId="g1" players={players} sessions={sessions} />)
  fireEvent.click(screen.getByRole('button', { name: 'CUSTOM' }))
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-01-01' } })
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-01-31' } })
  const row = screen.getByRole('link', { name: 'Alice' }).closest('tr')!
  expect(within(row).getByRole('link', { name: '+¥5' })).toBeTruthy()
  expect(within(row).getByRole('link', { name: '50%' })).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'Bob' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'CHART' }))
  let chart = JSON.parse(screen.getByTestId('leaderboard-chart').textContent!)
  expect(chart.data).toEqual([{ date: '2026-01-01', Alice: 10 }, { date: '2026-01-31', Alice: 5 }])
  fireEvent.click(screen.getByRole('button', { name: 'CHIPS' }))
  chart = JSON.parse(screen.getByTestId('leaderboard-chart').textContent!)
  expect(chart.data.map((point: { Alice: number }) => point.Alice)).toEqual([400, 300])
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-02-02' } })
  expect(screen.getByRole('alert').textContent).toContain('Start date must')
  expect(screen.queryByTestId('leaderboard-chart')).toBeNull()
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '' } })
  expect(screen.getByRole('alert').textContent).toContain('Choose a valid')
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-02-03' } })
  expect(screen.getByText('NO SESSIONS')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /^ALL$/ }))
  expect(JSON.parse(screen.getByTestId('leaderboard-chart').textContent!).data).toHaveLength(4)
})
