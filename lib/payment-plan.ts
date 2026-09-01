export interface PaymentBalance {
  playerId: string
  netChips: number
}

export interface PaymentTransfer {
  fromPlayerId: string
  toPlayerId: string
  amountCents: number
}

export interface PaymentPlan {
  roundingAdjustmentCents: number
  // Ordered by debtor loss, then input order; each debtor's transfers are
  // ordered by amount, then recipient input order.
  transfers: PaymentTransfer[]
}

interface OrderedBalance extends PaymentBalance {
  order: number
}

interface AllocatedBalance extends OrderedBalance {
  amountCents: number
  independentlyRoundedCents: number
}

const EXACT_BALANCE_LIMIT = 12

function allocateCents(balances: OrderedBalance[], exchangeRate: number, totalCents: number): AllocatedBalance[] {
  const allocations = balances.map(balance => {
    const exactCents = (Math.abs(balance.netChips) / exchangeRate) * 100
    return {
      ...balance,
      amountCents: Math.floor(exactCents),
      independentlyRoundedCents: Math.round(exactCents),
      remainder: exactCents - Math.floor(exactCents),
    }
  })
  let remaining = totalCents - allocations.reduce((sum, balance) => sum + balance.amountCents, 0)
  const byRemainder = [...allocations].sort((a, b) =>
    b.remainder - a.remainder || a.order - b.order || a.playerId.localeCompare(b.playerId))
  for (let index = 0; index < byRemainder.length && remaining > 0; index++, remaining--) {
    byRemainder[index].amountCents++
  }
  return allocations.map(({ remainder: _remainder, ...balance }) => balance)
}

function maxParticipantDegree(transfers: PaymentTransfer[]): number {
  const degree = new Map<string, number>()
  for (const transfer of transfers) {
    degree.set(transfer.fromPlayerId, (degree.get(transfer.fromPlayerId) ?? 0) + 1)
    degree.set(transfer.toPlayerId, (degree.get(transfer.toPlayerId) ?? 0) + 1)
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
    const difference = (orderByPlayer.get(leftTransfer.fromPlayerId) ?? Number.MAX_SAFE_INTEGER)
      - (orderByPlayer.get(rightTransfer.fromPlayerId) ?? Number.MAX_SAFE_INTEGER)
      || (orderByPlayer.get(leftTransfer.toPlayerId) ?? Number.MAX_SAFE_INTEGER)
      - (orderByPlayer.get(rightTransfer.toPlayerId) ?? Number.MAX_SAFE_INTEGER)
      || leftTransfer.amountCents - rightTransfer.amountCents
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
  const debtorAmounts = losers.map(balance => balance.amountCents)
  const creditorAmounts = winners.map(balance => balance.amountCents)
  const orderByPlayer = new Map([...losers, ...winners].map(balance => [balance.playerId, balance.order]))
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
        fromPlayerId: losers[debtorIndex].playerId,
        toPlayerId: winners[creditorIndex].playerId,
        amountCents: amount,
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
    debts.sort((a, b) => b.amountCents - a.amountCents || a.order - b.order || a.playerId.localeCompare(b.playerId))
    credits.sort((a, b) => b.amountCents - a.amountCents || a.order - b.order || a.playerId.localeCompare(b.playerId))
    const debtor = debts[0]
    const creditor = credits[0]
    const amount = Math.min(debtor.amountCents, creditor.amountCents)
    transfers.push({ fromPlayerId: debtor.playerId, toPlayerId: creditor.playerId, amountCents: amount })
    debtor.amountCents -= amount
    creditor.amountCents -= amount
    if (debtor.amountCents === 0) debts.shift()
    if (creditor.amountCents === 0) credits.shift()
  }
  return transfers
}

function sortTransfers(transfers: PaymentTransfer[], balances: OrderedBalance[]): PaymentTransfer[] {
  const balanceByPlayer = new Map(balances.map(balance => [balance.playerId, balance]))
  return [...transfers].sort((a, b) => {
    const fromA = balanceByPlayer.get(a.fromPlayerId)!
    const fromB = balanceByPlayer.get(b.fromPlayerId)!
    return fromA.netChips - fromB.netChips
      || fromA.order - fromB.order
      || b.amountCents - a.amountCents
      || (balanceByPlayer.get(a.toPlayerId)?.order ?? 0) - (balanceByPlayer.get(b.toPlayerId)?.order ?? 0)
  })
}

// Input order is the stable tie-break for rounding, equivalent minimum plans,
// and transfers between equal balances.
export function buildPaymentPlan(balances: PaymentBalance[], exchangeRate: number): PaymentPlan {
  if (balances.reduce((sum, balance) => sum + balance.netChips, 0) !== 0) {
    throw new Error('Payment balances must sum to zero')
  }
  const orderedBalances = balances.map((balance, order) => ({ ...balance, order }))
  const loserInputs = orderedBalances.filter(balance => balance.netChips < 0)
  const winnerInputs = orderedBalances.filter(balance => balance.netChips > 0)
  const totalCents = Math.round(
    (winnerInputs.reduce((sum, balance) => sum + balance.netChips, 0) / exchangeRate) * 100,
  )
  const losers = allocateCents(loserInputs, exchangeRate, totalCents)
  const winners = allocateCents(winnerInputs, exchangeRate, totalCents)
  const roundingAdjustment = Math.max(
    losers.reduce((sum, balance) => sum + Math.abs(balance.amountCents - balance.independentlyRoundedCents), 0),
    winners.reduce((sum, balance) => sum + Math.abs(balance.amountCents - balance.independentlyRoundedCents), 0),
  )
  const transfers = losers.length + winners.length <= EXACT_BALANCE_LIMIT
    ? exactTransfers(losers, winners)
    : greedyTransfers(losers, winners)

  return {
    roundingAdjustmentCents: roundingAdjustment,
    transfers: sortTransfers(transfers, orderedBalances),
  }
}
