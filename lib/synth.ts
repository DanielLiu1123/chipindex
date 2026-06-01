// Synthesize a "net result" into a single buy_in + final_chips.
// Used for after-the-fact entry/import: when only the net win/loss is known,
// construct a buy-in and final chips satisfying:
//   - amount is always an integer multiple of BUY_IN_UNIT
//   - final_chips is always >= 0
//   - final_chips - amount === net (zero error on the net result)
// Per-session conservation (Σfinal === Σamount) holds automatically when Σnet === 0.
export const BUY_IN_UNIT = 2000

export function synthFromNet(net: number): { amount: number; final_chips: number } {
  const amount = BUY_IN_UNIT * Math.max(1, Math.ceil(-net / BUY_IN_UNIT))
  return { amount, final_chips: amount + net }
}
