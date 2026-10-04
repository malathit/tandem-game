import { describe, expect, it } from 'vitest'
import { allowanceResetTime } from './allowanceReset'

describe('allowanceResetTime', () => {
  it('is midnight UTC on the clock of the player', () => {
    const reset = allowanceResetTime(new Date('2026-10-04T15:30:00Z'))
    const expected = new Date('2026-10-05T00:00:00Z').toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    expect(reset).toBe(expected)
  })

  it('does not depend on the time of day', () => {
    expect(allowanceResetTime(new Date('2026-10-04T00:00:01Z'))).toBe(allowanceResetTime(new Date('2026-10-04T23:59:59Z')))
  })
})
