// Shared by the form and command parser; amounts are stored as PostgreSQL int4.
export const MAX_BUY_IN_AMOUNT = 2_147_483_647
export const MAX_BATCH_PLAYERS = 100

export function parseBuyInAmount(value: string): number | null {
  if (!/^\d+$/.test(value)) return null
  const amount = Number(value)
  return Number.isSafeInteger(amount) && amount > 0 && amount <= MAX_BUY_IN_AMOUNT ? amount : null
}
