export interface PaymentBalance {
  player_id: string
  net_chips: number
  order: number
}

export interface PaymentTransfer {
  from_player_id: string
  to_player_id: string
  amount_cents: number
}

export interface PaymentPlan {
  balanced: boolean
  exact: boolean
  rounding_adjustment_cents: number
  transfers: PaymentTransfer[]
}

interface AllocatedBalance extends PaymentBalance {
  amount_cents: number
  independently_rounded_cents: number
}

const EXACT_BALANCE_LIMIT = 12

function allocateCents(balances: PaymentBalance[], exchangeRate: number, totalCents: number): AllocatedBalance[] {
  const allocations = balances.map(balance => {
    const exactCents = (Math.abs(balance.net_chips) / exchangeRate) * 100
    return {
      ...balance,
      amount_cents: Math.floor(exactCents),
      independently_rounded_cents: Math.round(exactCents),
      remainder: exactCents - Math.floor(exactCents),
    }
  })
  let remaining = totalCents - allocations.reduce((sum, balance) => sum + balance.amount_cents, 0)
  const byRemainder = [...allocations].sort((a, b) =>
    b.remainder - a.remainder || a.order - b.order || a.player_id.localeCompare(b.player_id))
  for (let index = 0; index < byRemainder.length && remaining > 0; index++, remaining--) {
    byRemainder[index].amount_cents++
  }
  return allocations.map(({ remainder: _remainder, ...balance }) => balance)
}

function maxParticipantDegree(transfers: PaymentTransfer[]): number {
  const degree = new Map<string, number>()
  for (const transfer of transfers) {
    degree.set(transfer.from_player_id, (degree.get(transfer.from_player_id) ?? 0) + 1)
    degree.set(transfer.to_player_id, (degree.get(transfer.to_player_id) ?? 0) + 1)
  }
  return Math.max(0, ...degree.values())
}

function compareTransferSignatures(
  left: PaymentTransfer[],
  right: PaymentTransfer[],
  orderByPlayer: ReadonlyMap<string, number>,
): number {
  for (let index = 0; index < left.length; index++) {
    const leftTransfer = left[index]
    const rightTransfer = right[index]
    const difference = (orderByPlayer.get(leftTransfer.from_player_id) ?? Number.MAX_SAFE_INTEGER)
      - (orderByPlayer.get(rightTransfer.from_player_id) ?? Number.MAX_SAFE_INTEGER)
      || (orderByPlayer.get(leftTransfer.to_player_id) ?? Number.MAX_SAFE_INTEGER)
      - (orderByPlayer.get(rightTransfer.to_player_id) ?? Number.MAX_SAFE_INTEGER)
      || leftTransfer.amount_cents - rightTransfer.amount_cents
    if (difference !== 0) return difference
  }
  return 0
}

function isBetterPlan(
  candidate: PaymentTransfer[],
  best: PaymentTransfer[] | null,
  orderByPlayer: ReadonlyMap<string, number>,
): boolean {
  if (!best) return true
  if (candidate.length !== best.length) return candidate.length < best.length
  const candidateDegree = maxParticipantDegree(candidate)
  const bestDegree = maxParticipantDegree(best)
  if (candidateDegree !== bestDegree) return candidateDegree < bestDegree
  return compareTransferSignatures(candidate, best, orderByPlayer) < 0
}

function exactTransfers(losers: AllocatedBalance[], winners: AllocatedBalance[]): PaymentTransfer[] {
  const debtorAmounts = losers.map(balance => balance.amount_cents)
  const creditorAmounts = winners.map(balance => balance.amount_cents)
  const orderByPlayer = new Map([...losers, ...winners].map(balance => [balance.player_id, balance.order]))
  const current: PaymentTransfer[] = []
  let best: PaymentTransfer[] | null = null

  function search(debtorIndex: number, minimumCreditorIndex = 0): void {
    const startingDebtorIndex = debtorIndex
    while (debtorIndex < debtorAmounts.length && debtorAmounts[debtorIndex] === 0) debtorIndex++
    if (debtorIndex !== startingDebtorIndex) minimumCreditorIndex = 0
    if (debtorIndex === debtorAmounts.length) {
      if (isBetterPlan(current, best, orderByPlayer)) best = current.map(transfer => ({ ...transfer }))
      return
    }
    if (best && current.length >= best.length) return

    const seenCreditorAmounts = new Set<number>()
    for (let creditorIndex = minimumCreditorIndex; creditorIndex < creditorAmounts.length; creditorIndex++) {
      const credit = creditorAmounts[creditorIndex]
      if (credit === 0 || seenCreditorAmounts.has(credit)) continue
      seenCreditorAmounts.add(credit)
      const amount = Math.min(debtorAmounts[debtorIndex], credit)
      debtorAmounts[debtorIndex] -= amount
      creditorAmounts[creditorIndex] -= amount
      current.push({
        from_player_id: losers[debtorIndex].player_id,
        to_player_id: winners[creditorIndex].player_id,
        amount_cents: amount,
      })
      search(debtorIndex, creditorIndex + 1)
      current.pop()
      debtorAmounts[debtorIndex] += amount
      creditorAmounts[creditorIndex] += amount
    }
  }

  search(0)
  return best ?? []
}

function greedyTransfers(losers: AllocatedBalance[], winners: AllocatedBalance[]): PaymentTransfer[] {
  const debts = losers.map(balance => ({ ...balance }))
  const credits = winners.map(balance => ({ ...balance }))
  const transfers: PaymentTransfer[] = []
  while (debts.length > 0 && credits.length > 0) {
    debts.sort((a, b) => b.amount_cents - a.amount_cents || a.order - b.order || a.player_id.localeCompare(b.player_id))
    credits.sort((a, b) => b.amount_cents - a.amount_cents || a.order - b.order || a.player_id.localeCompare(b.player_id))
    const debtor = debts[0]
    const creditor = credits[0]
    const amount = Math.min(debtor.amount_cents, creditor.amount_cents)
    transfers.push({ from_player_id: debtor.player_id, to_player_id: creditor.player_id, amount_cents: amount })
    debtor.amount_cents -= amount
    creditor.amount_cents -= amount
    if (debtor.amount_cents === 0) debts.shift()
    if (creditor.amount_cents === 0) credits.shift()
  }
  return transfers
}

function sortTransfers(transfers: PaymentTransfer[], balances: PaymentBalance[]): PaymentTransfer[] {
  const balanceByPlayer = new Map(balances.map(balance => [balance.player_id, balance]))
  return [...transfers].sort((a, b) => {
    const fromA = balanceByPlayer.get(a.from_player_id)!
    const fromB = balanceByPlayer.get(b.from_player_id)!
    return fromA.net_chips - fromB.net_chips
      || fromA.order - fromB.order
      || b.amount_cents - a.amount_cents
      || (balanceByPlayer.get(a.to_player_id)?.order ?? 0) - (balanceByPlayer.get(b.to_player_id)?.order ?? 0)
  })
}

export function buildPaymentPlan(balances: PaymentBalance[], exchangeRate: number): PaymentPlan {
  if (balances.reduce((sum, balance) => sum + balance.net_chips, 0) !== 0) {
    return { balanced: false, exact: true, rounding_adjustment_cents: 0, transfers: [] }
  }
  const byEntryOrder = (a: PaymentBalance, b: PaymentBalance) =>
    a.order - b.order || a.player_id.localeCompare(b.player_id)
  const loserInputs = balances.filter(balance => balance.net_chips < 0).sort(byEntryOrder)
  const winnerInputs = balances.filter(balance => balance.net_chips > 0).sort(byEntryOrder)
  const totalCents = Math.round(
    (winnerInputs.reduce((sum, balance) => sum + balance.net_chips, 0) / exchangeRate) * 100,
  )
  const losers = allocateCents(loserInputs, exchangeRate, totalCents)
  const winners = allocateCents(winnerInputs, exchangeRate, totalCents)
  const roundingAdjustment = Math.max(
    losers.reduce((sum, balance) => sum + Math.abs(balance.amount_cents - balance.independently_rounded_cents), 0),
    winners.reduce((sum, balance) => sum + Math.abs(balance.amount_cents - balance.independently_rounded_cents), 0),
  )
  const exact = losers.length + winners.length <= EXACT_BALANCE_LIMIT
  const transfers = exact
    ? exactTransfers(losers, winners)
    : greedyTransfers(losers, winners)

  return {
    balanced: true,
    exact,
    rounding_adjustment_cents: roundingAdjustment,
    transfers: sortTransfers(transfers, balances),
  }
}
