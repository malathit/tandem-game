/** When the daily allowance resets (midnight UTC), as a time on the player's own clock. */
export function allowanceResetTime(now: Date = new Date()): string {
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return reset.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
