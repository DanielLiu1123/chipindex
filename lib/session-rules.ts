export const DEFAULT_EXCHANGE_RATE = 40
export const BUY_IN_UNIT = 2000

// Every player tied for the highest net result is POG, including zero/negative ties.
export function pogPlayerIds(entries: ReadonlyArray<{ player_id: string; chips: number }>): string[] {
  if (!entries.length) return []
  const top = entries.reduce((maximum, entry) => Math.max(maximum, entry.chips), -Infinity)
  return entries.filter(entry => entry.chips === top).map(entry => entry.player_id).sort()
}
