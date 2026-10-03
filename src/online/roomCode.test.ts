import { describe, expect, it } from 'vitest'
import { CODE_LENGTH, generateRoomCode, normalizeRoomCode } from './roomCode'

describe('generateRoomCode', () => {
  it('maps random bytes onto the code alphabet', () => {
    const bytes = () => Uint8Array.from([0, 1, 2, 3, 31])
    expect(generateRoomCode(bytes)).toBe('ABCD9')
  })

  it('makes codes of the expected length that are valid when typed back in', () => {
    for (let run = 0; run < 100; run++) {
      const code = generateRoomCode()
      expect(code).toHaveLength(CODE_LENGTH)
      expect(normalizeRoomCode(code)).toBe(code)
    }
  })

  it('never uses look-alike characters', () => {
    for (let run = 0; run < 200; run++) {
      expect(generateRoomCode()).not.toMatch(/[IO01]/)
    }
  })
})

describe('normalizeRoomCode', () => {
  it.each([
    [' k7qxz ', 'K7QXZ'],
    ['k7 qxz', 'K7QXZ'],
    ['k7-qxz', 'K7QXZ'],
  ])('cleans up %j', (input, expected) => {
    expect(normalizeRoomCode(input)).toBe(expected)
  })

  it.each([['', 'empty'], ['K7QX', 'too short'], ['K7QXZA', 'too long'], ['K7QX0', 'look-alike zero'], ['K7QXO', 'look-alike O'], ['K7QX!', 'punctuation']])(
    'rejects %j (%s)',
    (input) => {
      expect(normalizeRoomCode(input)).toBeNull()
    },
  )
})
