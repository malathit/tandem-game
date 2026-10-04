import { describe, expect, it } from 'vitest'
import { CODE_LENGTH, generateRoomCode, normalizeRoomCode } from './roomCode'

describe('generateRoomCode', () => {
  it('maps random bytes onto digits', () => {
    const bytes = () => Uint8Array.from([0, 1, 2, 3, 4, 249])
    expect(generateRoomCode(bytes)).toBe('012349')
  })

  it('skips bytes that would make some digits more likely than others', () => {
    const batches = [Uint8Array.from([250, 255, 7, 251, 8, 252]), Uint8Array.from([9, 9, 9, 9, 9, 9])]
    expect(generateRoomCode(() => batches.shift()!)).toBe('789999')
  })

  it('makes codes of the expected length that are valid when typed back in', () => {
    for (let run = 0; run < 100; run++) {
      const code = generateRoomCode()
      expect(code).toHaveLength(CODE_LENGTH)
      expect(normalizeRoomCode(code)).toBe(code)
    }
  })

  it('uses digits only', () => {
    for (let run = 0; run < 200; run++) {
      expect(generateRoomCode()).toMatch(/^[0-9]+$/)
    }
  })
})

describe('normalizeRoomCode', () => {
  it.each([
    [' 482 913 ', '482913'],
    ['482-913', '482913'],
    ['048291', '048291'],
  ])('cleans up %j', (input, expected) => {
    expect(normalizeRoomCode(input)).toBe(expected)
  })

  it.each([['', 'empty'], ['48291', 'too short'], ['4829133', 'too long'], ['48291a', 'a letter'], ['48291!', 'punctuation']])(
    'rejects %j (%s)',
    (input) => {
      expect(normalizeRoomCode(input)).toBeNull()
    },
  )
})
