// @vitest-environment jsdom
import { render, cleanup } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import BuyInNotice from '@/components/BuyInNotice'
import { toast } from 'sonner'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), dismiss: vi.fn() } }))
afterEach(() => { cleanup(); vi.clearAllMocks() })

it('waits for refreshed totals, keeps a single toast across rerenders, and cleans it up', () => {
  const command = { amount: 2000, entries: [{ id: 'buyin-1', player_id: 'alice' }] }
  const player = { player_id: 'alice', name: 'Alice', total_buyin: 4000, final_chips: null, settled_at: null, buy_ins: [{ id: 'buyin-1', player_id: 'alice', amount: 2000, created_at: '' }] }
  const firstDismiss = vi.fn()
  const latestDismiss = vi.fn()
  const view = render(<BuyInNotice command={command} participants={[]} onDismiss={firstDismiss} />)
  expect(toast.success).not.toHaveBeenCalled()
  view.rerender(<BuyInNotice command={command} participants={[player]} onDismiss={firstDismiss} />)
  expect(toast.success).toHaveBeenCalledWith('Buy-in summary', expect.objectContaining({ id: 'buyin-1', description: 'Alice: 4,000 chips' }))
  view.rerender(<BuyInNotice command={command} participants={[player]} onDismiss={latestDismiss} />)
  expect(toast.success).toHaveBeenCalledTimes(1)
  const options = vi.mocked(toast.success).mock.calls[0][1]!
  options.onAutoClose!({ id: 'buyin-1' })
  expect(latestDismiss).toHaveBeenCalledTimes(1)
  expect(firstDismiss).not.toHaveBeenCalled()
  view.unmount()
  expect(toast.dismiss).toHaveBeenCalledWith('buyin-1')
})
