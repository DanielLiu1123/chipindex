// Format a monetary amount for display: thousands separators, up to 2 decimal
// places, with a trailing .00 omitted. Whole numbers render without decimals.
export function formatAmount(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}
