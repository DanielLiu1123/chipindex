// Chip accounting rules, as pure functions. Every net/total/conservation
// computation in the app goes through this module so the formulas have a
// single definition and a directly testable interface.

export function buyinSum(buyIns: { amount: number }[]): number {
  return buyIns.reduce((sum, b) => sum + b.amount, 0)
}

// Net result for one player: final chip count minus everything they bought in.
export function netChips(finalChips: number | null, buyinTotal: number): number {
  return (finalChips ?? 0) - buyinTotal
}

// Chips converted to CNY at the session's exchange rate, rounded to whole yuan.
export function toCny(chips: number, exchangeRate: number): number {
  return Math.round(chips / exchangeRate)
}

export interface ConservationResult {
  balanced: boolean
  diff: number
  total_buyin: number
  total_final: number
}

// Conservation invariant: chips on the table at settle time must equal chips
// bought in (Σfinal === Σbuyin). diff > 0 means surplus chips, < 0 means missing.
export function checkConservation(totalBuyin: number, totalFinal: number): ConservationResult {
  return {
    balanced: totalFinal === totalBuyin,
    diff: totalFinal - totalBuyin,
    total_buyin: totalBuyin,
    total_final: totalFinal,
  }
}
